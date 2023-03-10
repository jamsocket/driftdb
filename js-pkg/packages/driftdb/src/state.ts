import { DbConnection } from './index'
import { SequenceValue } from './types'

export class StateListener<T> {
  lastUpdateSent = 0
  lastValue: T | null = null
  debounceTimeout: number | null = null
  state: T | null = null

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
    this.state = value.value as T
  }

  sendUpdate() {
    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }
    this.db?.send({
      type: 'push',
      action: { type: 'replace' },
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
