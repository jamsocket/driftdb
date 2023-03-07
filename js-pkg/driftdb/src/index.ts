import { LatencyTest } from "./latency"
import { ConnectionStatus, MessageFromDb, MessageToDb, SequenceValue, Key } from "./types"
export { PresenceListener } from "./presence"
export type { WrappedPresenceMessage, PresenceMessage } from "./presence"
export { StateListener } from "./state"
export { Reducer } from "./reducer"
export { Api, RoomResult } from "./api"
export { HttpConnection } from "./http"
import * as CBOR from 'cbor-web';

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

    subscribe(key: Key, listener: (event: T) => void) {
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

    dispatch(key: Key, event: T) {
        if (!this.subscriptions.has(key)) {
            return
        }

        const subscription = this.subscriptions.get(key)!
        subscription.dispatch(event)
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
    private reconnectLoopHandle: ReturnType<typeof setTimeout> | null = null
    private activeLatencyTest: LatencyTest | null = null
    private cbor = false

    connect(dbUrl: string, cbor: boolean = false): Promise<void> {
        if (cbor) {
            dbUrl = dbUrl + "?cbor=true"
        }
        
        this.dbUrl = dbUrl
        this.cbor = cbor

        var resolve: () => void
        var reject: (err: any) => void
        const promise = new Promise<void>((res, rej) => {
            resolve = res
            reject = rej
        })

        if (this.connection) {
            this.connection.close()
        }

        this.connection = new WebSocket(dbUrl)
        this.connection.binaryType = 'arraybuffer'

        this.connection.onopen = () => {
            if (this.reconnectLoopHandle) {
                clearInterval(this.reconnectLoopHandle)
                this.reconnectLoopHandle = null
            }

            this.setStatus(true)

            this.queue.forEach(message => {
                this.send(message)
            })

            this.queue = []
            resolve()
        }

        this.connection.onerror = (err: any) => {
            console.error("DriftDB connection error", err)
            this.setStatus(false)
            reject(err)
        }

        this.connection.onclose = () => {
            this.setStatus(false)

            console.log("Connection closed, attempting to reconnect...")

            this.reconnectLoopHandle = setTimeout(() => {
                this.connect(dbUrl, cbor)
            }, 1000)
        }

        this.connection.onmessage = (event) => {
            let message: MessageFromDb
            if (event.data instanceof ArrayBuffer) {
                message = CBOR.decode(event.data)
            } else {
                message = JSON.parse(event.data)
            }
            
            this.messageListener.dispatch(message)

            switch (message.type) {
                case 'init':
                    let key = message.key
                    message.data.forEach((value) => {
                        this.subscriptions.dispatch(key, value)
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
                default:
                    console.error("Unknown message type", message.type)
            }
        }

        return promise
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
        if (this.connection !== null) {
            this.connection.onclose = null
            this.connection.onerror = null
            this.connection.onmessage = null
            this.connection.onopen = null
            this.connection.close()
        }
        this.subscriptions = new SubscriptionManager()
        this.sizeSubscriptions = new SubscriptionManager()
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

        if (this.cbor) {
            this.connection!.send(CBOR.encode(message))
        } else {
            this.connection!.send(JSON.stringify(message))
        }
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

export function uniqueClientId(): string {
    if (sessionStorage.getItem(CLIENT_ID_KEY)) {
        return sessionStorage.getItem(CLIENT_ID_KEY)!
    } else {
        let clientId = crypto.randomUUID()
        sessionStorage.setItem(CLIENT_ID_KEY, clientId)
        return clientId
    }
}
