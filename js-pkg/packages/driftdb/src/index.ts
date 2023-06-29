import * as CBOR from 'cbor-web'
import { LatencyTest } from './latency'
import { ConnectionStatus, Key, MessageFromDb, MessageToDb, SequenceValue } from './types'
export { Api } from './api'
export type { RoomResult } from './api'
export { HttpConnection } from './http'
export { PresenceListener } from './presence'
export type { PresenceMessage, WrappedPresenceMessage } from './presence'
export { Reducer } from './reducer'
export { StateListener } from './state'
export type { ConnectionStatus, Key, MessageFromDb, MessageToDb, SequenceValue } from './types'
export { SyncedWebRTCConnections } from './webrtc'
export type { DataChannelMsg } from './webrtc'

const CLIENT_ID_KEY = '_driftdb_client_id'

export interface SubscribeOptions {
  /** Whether to replay history when subscribing. */
  replay?: boolean
}

export type DbConnectionParams = {
  // The constructor to use for WebSocket connections.
  websocketConstructor?: typeof WebSocket
}

/**
 * A connection to a DriftDB room.
 */
export class DbConnection {
  connection: WebSocket | null = null
  status: ConnectionStatus = { connected: false }
  statusListener = new EventListener<ConnectionStatus>()
  messageListener = new EventListener<MessageFromDb>()
  subscriptions = new SubscriptionManager<SequenceValue>()
  sizeSubscriptions = new SubscriptionManager<number>()
  queue: Array<MessageToDb> = []
  dbUrl: string | null = null
  reconnectLoopHandle: ReturnType<typeof setTimeout> | null = null
  activeLatencyTest: LatencyTest | null = null
  cbor = false
  closed = false
  WebSocket: typeof WebSocket

  constructor(params?: DbConnectionParams) {
    if (params?.websocketConstructor !== undefined) {
      this.WebSocket = params?.websocketConstructor
    } else if (typeof WebSocket !== 'undefined') {
      this.WebSocket = WebSocket
    } else {
      throw new Error('websocketConstructor must be provided if WebSocket is not available')
    }
  }

  /**
   * Connect to a DriftDB room.
   * @param dbUrl The URL of the DriftDB room to connect to.
   * @param cbor Whether to use CBOR encoding for messages.
   *
   * @returns A promise that resolves when the connection is established.
   */
  connect(dbUrl: string, cbor: boolean = false): Promise<void> {
    if (cbor) {
      dbUrl = dbUrl + '?cbor=true'
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

    this.connection = new (this.WebSocket)(dbUrl)
    this.connection.binaryType = 'arraybuffer'

    this.connection.onopen = () => {
      if (this.reconnectLoopHandle) {
        clearInterval(this.reconnectLoopHandle)
        this.reconnectLoopHandle = null
      }

      this.setStatus(true)

      this.queue.forEach((message) => {
        this.send(message)
      })

      this.queue = []
      resolve()
    }

    this.connection.onerror = (err: any) => {
      if (!this.closed) {
        this.setStatus(false)
        reject(err)
      }
    }

    this.connection.onclose = () => {
      this.setStatus(false)

      console.log('Connection closed, attempting to reconnect...')

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
            value: message.value
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
        case 'error':
          console.error('Error from server:', message)
          break
        default:
          console.error('Unknown message type', (message as MessageFromDb).type)
      }
    }

    return promise
  }

  /**
   * Test the connection latency by sending a ping to the server.
   *
   * @returns A promise that resolves to the latency in milliseconds, or null if the connection is not open.
   */
  public testLatency(): Promise<number> | null {
    if (!this.status.connected || this.connection?.readyState !== this.WebSocket.OPEN) {
      return null
    }

    if (!this.activeLatencyTest) {
      this.activeLatencyTest = new LatencyTest()
      this.send({ type: 'ping' })
    }

    return this.activeLatencyTest.result()
  }

  /**
   * Get the URL of the DriftDB UI for this connection.
   *
   * @returns The URL of the DriftDB UI, or null if the connection is not open.
   */
  private debugUrl(): string | null {
    if (!this.dbUrl) {
      return null
    }
    return `https://ui.driftdb.com/?url=${encodeURIComponent(this.dbUrl)}`
  }

  /**
   * Close the connection to the DriftDB room.
   */
  disconnect() {
    this.closed = true
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

  private setStatus(connected: boolean) {
    this.status = connected ? { connected: true, debugUrl: this.debugUrl()! } : { connected: false }
    this.statusListener.dispatch(this.status)
  }

  /**
   * Send a message to the DriftDB server.
   *
   * @param message The message to send.
   */
  send(message: MessageToDb) {
    if (!this.status.connected || this.connection?.readyState !== this.WebSocket.OPEN) {
      this.queue.push(message)
      return
    }

    if (this.cbor) {
      this.connection!.send(CBOR.encode(message))
    } else {
      this.connection!.send(JSON.stringify(message))
    }
  }

  /**
   * Subscribe to a key in the DriftDB room.
   *
   * @param key The key to subscribe to.
   * @param listener A callback that will be called whenever a new value is pushed to the key.
   * @param sizeCallback An optional callback that will be called whenever the size of the
   * server's retained stream changes.
   */
  subscribe(
    key: Key,
    listener: (event: SequenceValue) => void,
    sizeCallback?: (size: number) => void,
    subscribeOptions?: SubscribeOptions
  ) {
    this.subscriptions.subscribe(key, listener)
    if (sizeCallback) {
      this.sizeSubscriptions.subscribe(key, sizeCallback)
    }
    if (subscribeOptions?.replay ?? true) {
      this.send({ type: 'get', key, seq: 0 })
    }
  }

  /**
   * Unsubscribe from a key in the DriftDB room.
   *
   * @param key The key to unsubscribe from.
   * @param listener The callback that was passed to `subscribe`.
   * @param sizeCallback The callback that was passed to `subscribe`.
   */
  unsubscribe(
    subject: Key,
    listener: (event: SequenceValue) => void,
    sizeCallback?: (size: number) => void
  ) {
    this.subscriptions.unsubscribe(subject, listener)
    if (sizeCallback) {
      this.sizeSubscriptions.unsubscribe(subject, sizeCallback)
    }
  }
}

/**
 * Generate a random client ID for the current client.
 *
 * The client ID is stored in session storage so that it is the same
 * across page reloads.
 *
 * @returns A random client ID that is stored in session storage.
 */
export function uniqueClientId(): string {
  if (sessionStorage.getItem(CLIENT_ID_KEY)) {
    return sessionStorage.getItem(CLIENT_ID_KEY)!
  } else {
    let clientId = crypto.randomUUID()
    sessionStorage.setItem(CLIENT_ID_KEY, clientId)
    return clientId
  }
}

class EventListener<T> {
  listeners: Array<(event: T) => void> = []

  addListener(listener: (event: T) => void) {
    this.listeners.push(listener)
  }

  removeListener(listener: (event: T) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }

  dispatch(event: T) {
    this.listeners.forEach((l) => l(event))
  }
}

class SubscriptionManager<T> {
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
