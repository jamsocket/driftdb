import { DbConnection } from './index'
import { SequenceValue } from './types'

type WrappedValue = {
  v: unknown
  i: string
}

/**
 * Provides a way to store a single value on a key in a DriftDB room, and listen
 * for changes to that value from other clients.
 */
export class StateListener<T> {
  lastUpdateSent = 0
  lastValue: T | null = null
  debounceTimeout: number | null = null
  debounceMillis: number
  state: T | null = null
  randId: string
  handler: (value: SequenceValue) => void
  callback: (value: T) => void
  db: DbConnection
  key: string

  constructor(opts: {
    callback: (value: T) => void,
    db: DbConnection,
    key: string,
    debounceMillis?: number
  }) {
    this.callback = opts.callback
    this.db = opts.db
    this.key = opts.key
    this.setStateOptimistic = this.setStateOptimistic.bind(this)
    this.sendUpdate = this.sendUpdate.bind(this)
    this.randId = Math.random().toString(36).substring(7)
    this.debounceMillis = opts.debounceMillis ?? 20
    this.handler = (value: SequenceValue) => {
      let wv = value.value as WrappedValue
      if (wv.i !== this.randId) {
        this.callback(wv.v as T)
      }
    }
  }

  subscribe() {
    this.db.subscribe(this.key, this.handler)
  }

  destroy() {
    this.db.unsubscribe(this.key, this.handler)
  }

  onMessage(value: SequenceValue) {
    this.callback(value.value as T)
    this.state = value.value as T
  }

  sendUpdate() {
    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }
    const v: WrappedValue = { v: this.lastValue, i: this.randId }
    this.db?.send({
      type: 'push',
      action: { type: 'replace' },
      value: v,
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
