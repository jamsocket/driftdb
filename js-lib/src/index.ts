type LaxSubject = string | Array<string>
type Subject = Array<string>
type SequenceNumber = number

export type Action = {type: 'Append' | 'Replace' | 'Relay'} | {type: 'Compact', seq: SequenceNumber}

export interface SequenceValue {
    value: any
    seq: SequenceNumber
}

export type MessageFromDb = {
    type: 'Push',
    key: Subject,
    value: SequenceValue,
} | {
    type: 'Init',
    prefix: Subject,
    data: Array<[Subject, Array<SequenceValue>]>
} | {
    type: 'Error',
    message: string
} | {
    type: 'SubjectSize',
    key: Subject,
    size: number
}

export type MessageToDb = {
    type: 'Push'
    action: Action
    value: any
    key: LaxSubject
} | {
    type: 'Dump'
    prefix: LaxSubject
}

export type ConnectionStatus = {
    connected: false
} | {
    connected: true
    debugUrl: string
}

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

    subscribe<T>(subject: Subject, listener: (event: T) => void) {
        const key = JSON.stringify(subject)
        if (!this.subscriptions.has(key)) {
            this.subscriptions.set(key, new EventListener())
        }

        const subscription = this.subscriptions.get(key)!
        subscription.addListener(listener)
    }

    unsubscribe<T>(subject: Subject, listener: (event: T) => void) {
        const key = JSON.stringify(subject)
        if (!this.subscriptions.has(key)) {
            return
        }

        const subscription = this.subscriptions.get(key)!
        subscription.removeListener(listener)
    }

    dispatch<T>(subject: Subject, event: T) {
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

    constructor() {}

    connect(dbUrl: string) {
        this.dbUrl = dbUrl
        this.connection = new WebSocket(dbUrl)
        
        this.connection.onopen = () => {
            this.setStatus(true)

            this.queue.forEach(message => {
                this.send(message)
            })
        }

        this.connection.onerror = () => {
            this.setStatus(false)
        }

        this.connection.onclose = () => {
            this.setStatus(false)
        }

        this.connection.onmessage = (event) => {
            const message: MessageFromDb = JSON.parse(event.data)
            this.messageListener.dispatch(message)

            switch (message.type) {
                case 'Init':
                    message.data.forEach(([key, values]) => {
                        values.forEach(value => {
                            this.subscriptions.dispatch(key, value)
                        })
                    })
                    break
                case 'Push':
                    this.subscriptions.dispatch(message.key, message.value)
                    break
                case 'SubjectSize':
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

    subscribe(subject: Subject, listener: (event: SequenceValue) => void, sizeCallback?: (size: number) => void) {
        this.subscriptions.subscribe(subject, listener)
        if (sizeCallback) {
            this.sizeSubscriptions.subscribe(subject, sizeCallback)
        }
        this.send({type: 'Dump', prefix: subject})
    }

    unsubscribe(subject: Subject, listener: (event: SequenceValue) => void, sizeCallback?: (size: number) => void) {
        this.subscriptions.unsubscribe(subject, listener)
        if (sizeCallback) {
            this.sizeSubscriptions.unsubscribe(subject, sizeCallback)
        }
    }
}
