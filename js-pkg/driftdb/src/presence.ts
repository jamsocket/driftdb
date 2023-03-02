import { DbConnection } from "."
import { SequenceValue } from "./types"

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
            for (const client in this.presence) {
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
        const message: PresenceMessage<T> = event.value as any
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
