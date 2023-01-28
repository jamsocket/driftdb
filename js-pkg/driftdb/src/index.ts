import { ConnectionStatus, MessageFromDb, MessageToDb, SequenceValue, Key } from "./types"

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

export class SubscriptionManager {
    subscriptions: Map<string, EventListener<any>> = new Map()

    subscribe<T>(subject: Key, listener: (event: T) => void) {
        const key = JSON.stringify(subject)
        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, new EventListener())
        }

        const subscription = this.subscriptions.get(key)!
        subscription.addListener(listener)
    }

    unsubscribe<T>(subject: Key, listener: (event: T) => void) {
        const key = JSON.stringify(subject)
        if (!this.subscriptions.has(key)) {
            return
        }

        const subscription = this.subscriptions.get(key)!
        subscription.removeListener(listener)
    }

    dispatch<T>(subject: Key, event: T) {
        const key = JSON.stringify(subject)
        if (!this.subscriptions.has(key)) {
            return
        }

        const subscription = this.subscriptions.get(key)!
        subscription.dispatch(event)
    }
}

export class DbConnection {
    connection: WebSocket | null = null
    status: ConnectionStatus = {connected: false}
    public statusListener = new EventListener<ConnectionStatus>()
    public messageListener = new EventListener<MessageFromDb>()
    subscriptions = new SubscriptionManager()
    sizeSubscriptions = new SubscriptionManager()
    private queue: Array<MessageToDb> = []
    private dbUrl: string | null = null
    private reconnectLoopHandle: number | null = null

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
                    this.subscriptions.dispatch(message.key, message.value)
                    break
                case 'stream_size':
                    this.sizeSubscriptions.dispatch(message.key, message.size)
                    break
            }
        }
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
        this.status = connected ? {connected: true, debugUrl: this.debugUrl()!} : {connected: false}
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
        this.send({type: 'get', key, seq: 0 })
    }

    unsubscribe(subject: Key, listener: (event: SequenceValue) => void, sizeCallback?: (size: number) => void) {
        this.subscriptions.unsubscribe(subject, listener)
        if (sizeCallback) {
            this.sizeSubscriptions.unsubscribe(subject, sizeCallback)
        }
    }
}
