import { DbConnection } from '.'
import { Compactor, Compactable } from './compactor'

class ReducerCompactable<T, A> extends Compactable<T, A> {
  constructor(private reducer: (state: T, action: A) => T, private initState: T) {
    super()
  }

  applyAction(state: T, action: A) {
    return this.reducer(state, action)
  }

  initialState(): T {
    return this.initState
  }

  optimistic = true
}

export class Reducer<T, A> {
  compactor: Compactor<T, A>

  constructor(opts: {
    /** A key identifying the stream to use for the reducer. */
    key: string

    /** The reducer function applied when dispatch is called. */
    reducer: (state: T, action: A) => T

    /** The initial state passed to the reducer. */
    initialValue: T

    /** The number of messages to keep in the stream before compacting. */
    sizeThreshold?: number

    /** The database connection to use. */
    db: DbConnection

    /** A callback function called when the state changes, either because of a local call to dispatch or a remote event. */
    callback: (state: T) => void
  }) {
    const compactable = new ReducerCompactable(opts.reducer, opts.initialValue)
    this.compactor = new Compactor({
      key: opts.key,
      compactable,
      sizeThreshold: opts.sizeThreshold,
      db: opts.db,
      callback: opts.callback
    })

    this.dispatch = this.dispatch.bind(this)
  }

  subscribe() {
    this.compactor.subscribe()
  }

  destroy() {
    this.compactor.destroy()
  }

  dispatch(action: A) {
    this.compactor.dispatch(action)
  }
}
