import { ConnectionStatus, MessageFromDb, MessageToDb, SequenceValue, Key } from "./types"

const CLIENT_ID_KEY = "_driftdb_client_id"

export class EventListener<T> {
    listeners: Array<(event: T) => void> = []

    addListener(listener: (event: T) => void) {
        this.listeners.push(listener)
    }

    removeListener(listener: (event: T) => void) {
        this.listeners = this.listeners.filter(l => l !== listener)
    }

    dispatch(event: T) {
        this.listeners.forEach(l => l(event))
    }
}

export class SubscriptionManager<T> {
    subscriptions: Map<string, EventListener<T>> = new Map()

    subscribe(subject: Key, listener: (event: T) => void) {
        const key = JSON.stringify(subject)
        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, new EventListener())
        }

        const subscription = this.subscriptions.get(key)!
        subscription.addListener(listener)
    }

    unsubscribe(subject: Key, listener: (event: T) => void) {
        const key = JSON.stringify(subject)
        if (!this.subscriptions.has(key)) {
            return
        }

        const subscription = this.subscriptions.get(key)!
        subscription.removeListener(listener)
    }

    dispatch(subject: Key, event: T) {
        const key = JSON.stringify(subject)
        if (!this.subscriptions.has(key)) {
            return
        }

        const subscription = this.subscriptions.get(key)!
        subscription.dispatch(event)
    }
}

export class LatencyTest {
    private startTime: number
    private endTime: number | null = null
    private signal: Promise<void>
    private resolve!: () => void

    constructor() {
        this.startTime = performance.now()
        this.signal = new Promise((resolve) => {
            this.resolve = resolve
        })
    }

    receivedResponse() {
        this.endTime = performance.now()
        this.resolve()
    }

    async result() {
        await this.signal
        return this.endTime! - this.startTime
    }
}

export class DbConnection {
    connection: WebSocket | null = null
    status: ConnectionStatus = { connected: false }
    public statusListener = new EventListener<ConnectionStatus>()
    public messageListener = new EventListener<MessageFromDb>()
    subscriptions = new SubscriptionManager<SequenceValue>()
    sizeSubscriptions = new SubscriptionManager<number>()
    private queue: Array<MessageToDb> = []
    private dbUrl: string | null = null
    private reconnectLoopHandle: number | null = null
    private activeLatencyTest: LatencyTest | null = null

    connect(dbUrl: string) {
        this.dbUrl = dbUrl

        if (this.connection) {
            this.connection.close()
        }

        this.connection = new WebSocket(dbUrl)

        this.connection.onopen = () => {
            if (this.reconnectLoopHandle) {
                window.clearInterval(this.reconnectLoopHandle)
                this.reconnectLoopHandle = null
            }

            this.setStatus(true)

            this.queue.forEach(message => {
                this.send(message)
            })

            this.queue = []
        }

        this.connection.onerror = (err: Event) => {
            console.error("DriftDB connection error", err)
            this.setStatus(false)
        }

        this.connection.onclose = () => {
            this.setStatus(false)

            console.log("Connection closed, attempting to reconnect...")

            this.reconnectLoopHandle = window.setTimeout(() => {
                this.connect(dbUrl)
            }, 1000)
        }

        this.connection.onmessage = (event) => {
            const message: MessageFromDb = JSON.parse(event.data)
            this.messageListener.dispatch(message)

            switch (message.type) {
                case 'init':
                    message.data.forEach((value) => {
                        this.subscriptions.dispatch(message.key, value)
                    })
                    break
                case 'push':
                    this.subscriptions.dispatch(message.key, {
                        seq: message.seq,
                        value: message.value,
                    })
                    break
                case 'stream_size':
                    this.sizeSubscriptions.dispatch(message.key, message.size)
                    break
                case 'pong':
                    if (this.activeLatencyTest) {
                        this.activeLatencyTest.receivedResponse()
                        this.activeLatencyTest = null
                    }
                    break
            }
        }
    }

    public testLatency(): Promise<number> | null {
        if (!this.status.connected || this.connection?.readyState !== WebSocket.OPEN) {
            return null
        }

        if (!this.activeLatencyTest) {
            this.activeLatencyTest = new LatencyTest()
            this.send({ type: 'ping' })
        }

        return this.activeLatencyTest.result()
    }

    private debugUrl() {
        if (!this.dbUrl) {
            return null
        }
        return `https://ui.driftdb.com/?url=${encodeURIComponent(this.dbUrl)}`
    }

    disconnect() {
        console.log('disconnecting')
        this.connection?.close()
    }

    setStatus(connected: boolean) {
        this.status = connected ? { connected: true, debugUrl: this.debugUrl()! } : { connected: false }
        this.statusListener.dispatch(this.status)
    }

    send(message: MessageToDb) {
        if (!this.status.connected || this.connection?.readyState !== WebSocket.OPEN) {
            this.queue.push(message)
            return
        }

        this.connection!.send(JSON.stringify(message))
    }

    subscribe(key: Key, listener: (event: SequenceValue) => void, sizeCallback?: (size: number) => void) {
        this.subscriptions.subscribe(key, listener)
        if (sizeCallback) {
            this.sizeSubscriptions.subscribe(key, sizeCallback)
        }
        this.send({ type: 'get', key, seq: 0 })
    }

    unsubscribe(subject: Key, listener: (event: SequenceValue) => void, sizeCallback?: (size: number) => void) {
        this.subscriptions.unsubscribe(subject, listener)
        if (sizeCallback) {
            this.sizeSubscriptions.unsubscribe(subject, sizeCallback)
        }
    }
}

export class StateListener<T> {
    lastUpdateSent: number = 0
    lastValue: T | null = null
    debounceTimeout: number | null = null

    constructor(
        private callback: (value: T) => void,
        private db: DbConnection,
        private key: string,
        private debounceMillis: number = 50
    ) {
        this.callback = callback.bind(this)
        this.setStateOptimistic = this.setStateOptimistic.bind(this)
        this.sendUpdate = this.sendUpdate.bind(this)

        db.subscribe(key, (value: SequenceValue) => {
            this.callback(value.value as T)
        })
    }

    onMessage(value: SequenceValue) {
        this.callback(value.value as T)
    }

    sendUpdate() {
        if (this.debounceTimeout !== null) {
            window.clearTimeout(this.debounceTimeout)
            this.debounceTimeout = null
        }
        this.db?.send({
            type: "push",
            action: { "type": "replace" },
            value: this.lastValue,
            key: this.key
        })
    }

    setStateOptimistic(value: T) {
        this.callback(value)

        this.lastValue = value
        const now = performance.now()
        if (now - this.lastUpdateSent < this.debounceMillis) {
            if (this.debounceTimeout === null) {
                this.debounceTimeout = window.setTimeout(this.sendUpdate, this.debounceMillis)
            }
        } else {
            this.lastUpdateSent = now
            this.sendUpdate()
        }
    }
}

export function uniqueClientId(): string {
    if (sessionStorage.getItem(CLIENT_ID_KEY)) {
        return sessionStorage.getItem(CLIENT_ID_KEY)!
    } else {
        let clientId = crypto.randomUUID()
        sessionStorage.setItem(CLIENT_ID_KEY, clientId)
        return clientId
    }
}

export interface PresenceMessage<T> {
    client: string
    value: T
}

export type WrappedPresenceMessage<T> = {
    value: T,
    lastSeen: number
}

interface PresenceListenerOptions<T> {
    initialState: T,
    db: DbConnection,
    clientId: string,
    key?: string,
    callback?: (presence: Record<string, WrappedPresenceMessage<T>>) => void,
    minPresenceInterval?: number,
    maxPresenceInterval?: number,
}

export class PresenceListener<T> {
    private state: T
    private key: string
    private clientId: string
    private db: DbConnection
    private callback: (presence: Record<string, WrappedPresenceMessage<T>>) => void
    private presence: Record<string, WrappedPresenceMessage<T>> = {}
    private interval: ReturnType<typeof setInterval>
    private minPresenceInterval: number
    private maxPresenceInterval: number

    // Time of the last update caused by a state change.
    private lastUpdate = 0

    // True if we have a pending update.
    private nextUpdate: number

    private updateHandle: ReturnType<typeof setTimeout>

    constructor(options: PresenceListenerOptions<T>) {
        this.nextUpdate = Date.now()

        this.state = options.initialState
        this.db = options.db
        this.key = options.key ?? "__presence"
        this.clientId = options.clientId
        this.callback = options.callback ?? (() => { })

        this.minPresenceInterval = options.minPresenceInterval ?? 20 // 20 ms
        this.maxPresenceInterval = options.maxPresenceInterval ?? 1_000 // 1 second

        this.updateHandle = setTimeout(() => {
            this.update()
        }, 0)

        this.onMessage = this.onMessage.bind(this)
        this.db.subscribe(this.key, this.onMessage)

        this.interval = setInterval(() => {
            for (let client in this.presence) {
                if (Date.now() - this.presence[client].lastSeen > this.maxPresenceInterval * 2) {
                    delete this.presence[client]
                }
            }
        }, this.maxPresenceInterval)
    }

    destroy() {
        clearInterval(this.interval)
        clearTimeout(this.updateHandle)
        this.db.unsubscribe(this.key, this.onMessage)
    }

    private onMessage(event: SequenceValue) {
        let message: PresenceMessage<T> = event.value as any
        if (message.client === this.clientId) {
            // Ignore our own messages.
            return
        }

        this.presence = {
            ...this.presence,
            [message.client]: {
                value: message.value,
                lastSeen: Date.now()
            }
        }

        this.callback(this.presence)
    }

    private update() {
        this.db.send({
            type: "push",
            action: { type: "relay" },
            value: { value: this.state, client: this.clientId },
            key: this.key
        })

        this.nextUpdate = Date.now() + this.maxPresenceInterval
        this.lastUpdate = Date.now()
        this.updateHandle = setTimeout(() => {
            this.update()
        }, this.maxPresenceInterval)
    }

    updateState(value: T) {
        if (JSON.stringify(value) === JSON.stringify(this.state)) {
            return
        }

        this.state = value

        const nextUpdate = this.lastUpdate + this.minPresenceInterval

        if (nextUpdate < this.nextUpdate) {
            this.nextUpdate = nextUpdate
            clearTimeout(this.updateHandle)
            this.updateHandle = setTimeout(() => {
                this.update()
            }, this.nextUpdate - Date.now())
        }
    }
}
