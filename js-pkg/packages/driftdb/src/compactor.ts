import { DbConnection } from '.'
import { SequenceValue } from './types'

export abstract class Compactable<T, A> {
  unpackState(state: any): T {
    return state
  }

  packState(state: T): any {
    return state
  }

  abstract applyAction(state: T, action: A): T

  abstract initialState(): T

  optimistic: boolean = false

  /// This should be true only if the reducer is commutative and idempotent.
  crdt: boolean = false
}

export class Compactor<T, A> {
  state: T
  lastConfirmedState: T | null
  lastConfirmedSeq: number
  db: DbConnection
  key: string
  callback: (state: T) => void
  sizeThreshold: number
  compactable: Compactable<T, A>

  /// Random token used to identify messages from this client.
  randId: string

  constructor(opts: {
    /** A key identifying the stream to use for the reducer. */
    key: string

    compactable: Compactable<T, A>

    /** The number of messages to keep in the stream before compacting. */
    sizeThreshold?: number

    /** The database connection to use. */
    db: DbConnection

    /** A callback function called when the state changes, either because of a local call to dispatch or a remote event. */
    callback: (state: T) => void
  }) {
    this.compactable = opts.compactable
    const state = this.compactable.initialState()
    this.lastConfirmedState = null
    this.state = state
    this.lastConfirmedSeq = 0
    this.db = opts.db
    this.randId = Math.random().toString(36).substring(7)

    this.key = opts.key
    this.callback = opts.callback
    this.sizeThreshold = opts.sizeThreshold || 30

    this.onSequenceValue = this.onSequenceValue.bind(this)
    this.onSize = this.onSize.bind(this)
    this.dispatch = this.dispatch.bind(this)
  }

  maybeClone(state: T): T {
    if (this.compactable.crdt) {
      return state
    } else {
      return structuredClone(state)
    }
  }

  subscribe() {
    this.lastConfirmedState = this.maybeClone(this.state)
    this.db.subscribe(this.key, this.onSequenceValue, this.onSize)
  }

  destroy() {
    this.db.unsubscribe(this.key, this.onSequenceValue, this.onSize)
  }

  dispatch(action: A) {
    this.db.send({
      type: 'push',
      action: { type: 'append' },
      value: { apply: action, i: this.randId },
      key: this.key
    })

    if (this.compactable.optimistic) {
      this.state = this.compactable.applyAction(this.state, action)
      this.callback(this.state)
    }
  }

  onSequenceValue(sequenceValue: SequenceValue) {
    if (sequenceValue.seq <= this.lastConfirmedSeq) {
      return
    }

    const value = sequenceValue.value as any

    if (value.reset !== undefined) {
      this.lastConfirmedState = this.compactable.unpackState(value.reset)
      this.lastConfirmedSeq = sequenceValue.seq
      this.state = this.maybeClone(this.lastConfirmedState)
      this.callback(this.state)
      return
    }

    if (value.apply !== undefined) {
      this.lastConfirmedState = this.compactable.applyAction(
        this.lastConfirmedState!,
        value.apply as A
      )
      this.lastConfirmedSeq = sequenceValue.seq

      if (value.i !== this.randId || !this.compactable.optimistic) {
        this.state = this.maybeClone(this.lastConfirmedState)
        this.callback(this.state)
      }
      return
    }

    console.log('Unknown message', sequenceValue.value)
  }

  onSize(size: number) {
    if (size > this.sizeThreshold && this.lastConfirmedSeq !== 0) {
      const newState = this.compactable.packState(this.lastConfirmedState!)
      this.db?.send({
        type: 'push',
        action: { type: 'compact', seq: this.lastConfirmedSeq },
        value: { reset: newState },
        key: this.key
      })
    }
  }
}
