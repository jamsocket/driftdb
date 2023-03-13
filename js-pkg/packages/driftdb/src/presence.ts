import { DbConnection } from '.'
import { SequenceValue } from './types'

export interface PresenceMessage<T> {
  client: string
  value: T
}

export type WrappedPresenceMessage<T> = {
  value: T
  lastSeen: number
}

/**
 * A class that listens for presence messages and broadcasts the client's own
 * presence messages.
 */
export class PresenceListener<T> {
  private state: T
  private key: string
  private clientId: string
  private db: DbConnection
  private callback: (presence: Record<string, WrappedPresenceMessage<T>>) => void
  private presence: Record<string, WrappedPresenceMessage<T>> = {}
  private interval: ReturnType<typeof setInterval> | null = null
  private minPresenceInterval: number
  private maxPresenceInterval: number

  // Time of the last update caused by a state change.
  private lastUpdate = 0

  // True if we have a pending update.
  private nextUpdate: number

  private updateHandle: ReturnType<typeof setTimeout> | null = null

  constructor(options: {
    /** Initial state of the client's own presence. */
    initialState: T

    /** Connection to the DriftDB room. */
    db: DbConnection

    /** Client ID. */
    clientId: string

    /** Key to listen for presence messages on (defaults to `__presence`). */
    key?: string

    /** Callback to call when the presence of any peer changes. */
    callback?: (presence: Record<string, WrappedPresenceMessage<T>>) => void

    /** Minimum interval between presence updates (defaults to 20 ms). */
    minPresenceInterval?: number

    /** Maximum interval between presence updates (defaults to 1 second). */
    maxPresenceInterval?: number
  }) {
    this.nextUpdate = Date.now()

    this.state = options.initialState
    this.db = options.db
    this.key = options.key ?? '__presence'
    this.clientId = options.clientId
    this.callback = options.callback ?? (() => {})

    this.minPresenceInterval = options.minPresenceInterval ?? 20 // 20 ms
    this.maxPresenceInterval = options.maxPresenceInterval ?? 1_000 // 1 second

    this.onMessage = this.onMessage.bind(this)
  }

  subscribe() {
    this.updateHandle = setTimeout(() => {
      this.update()
    }, 0)
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
    if (this.interval !== null) {
      clearInterval(this.interval)
    }
    
    if (this.updateHandle !== null) {
      clearTimeout(this.updateHandle)
    }
    
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
      type: 'push',
      action: { type: 'relay' },
      value: { value: this.state, client: this.clientId },
      key: this.key
    })

    this.nextUpdate = Date.now() + this.maxPresenceInterval
    this.lastUpdate = Date.now()
    this.updateHandle = setTimeout(() => {
      this.update()
    }, this.maxPresenceInterval)
  }

  /**
   * Update the client's own presence state.
   *
   * This is debounced locally, so if it is called multiple times in a short
   * period of time, only the last call will be sent.
   */
  updateState(value: T) {
    if (JSON.stringify(value) === JSON.stringify(this.state)) {
      return
    }

    this.state = value

    const nextUpdate = this.lastUpdate + this.minPresenceInterval

    if (nextUpdate < this.nextUpdate) {
      this.nextUpdate = nextUpdate

      if (this.updateHandle !== null) {
        clearTimeout(this.updateHandle)
      }
      this.updateHandle = setTimeout(() => {
        this.update()
      }, this.nextUpdate - Date.now())
    }
  }
}
