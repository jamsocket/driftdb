import { DbConnection } from "."
import { SequenceValue } from "./types"

export interface ReducerOpts<T, A> {
    key: string,
    reducer: (state: T, action: A) => T,
    initialValue: T,
    sizeThreshold?: number,
    db: DbConnection,
    callback: (state: T) => void
}

export class Reducer<T, A> {
    state: any
    lastConfirmedState: any
    lastConfirmedSeq: number
    db: DbConnection
    reducer: (state: any, action: any) => any
    key: string
    callback: (state: T) => void
    sizeThreshold: number

    constructor(opts: ReducerOpts<T, A>) {
        this.state = structuredClone(opts.initialValue)
        this.lastConfirmedState = structuredClone(opts.initialValue)
        this.lastConfirmedSeq = 0
        this.db = opts.db
        this.reducer = opts.reducer
        this.key = opts.key
        this.callback = opts.callback
        this.sizeThreshold = opts.sizeThreshold || 30

        this.onSequenceValue = this.onSequenceValue.bind(this)
        this.onSize = this.onSize.bind(this)
        this.dispatch = this.dispatch.bind(this)

        this.db.subscribe(this.key, this.onSequenceValue, this.onSize)
    }

    dispose() {
        this.db.unsubscribe(this.key, this.onSequenceValue, this.onSize)
    }

    dispatch(action: A) {
        this.state = this.reducer(this.state, action)
        this.db.send({ type: "push", action: { "type": "append" }, value: { "apply": action }, key: this.key })

        this.callback(this.state)
    }

    onSequenceValue(sequenceValue: SequenceValue) {
        if (sequenceValue.seq <= this.lastConfirmedSeq) {
            return;
        }

        const value = sequenceValue.value as any;

        if (value.reset !== undefined) {
            this.lastConfirmedState = value.reset as T;
            this.lastConfirmedSeq = sequenceValue.seq;
            this.callback(structuredClone(this.lastConfirmedState.current));
            return;
        }

        if (value.apply !== undefined) {
            this.lastConfirmedState = this.reducer(this.lastConfirmedState, value.apply as A);
            this.lastConfirmedSeq = sequenceValue.seq;
            this.callback(structuredClone(this.lastConfirmedState));
            return;
        }

        console.log("Unknown message", sequenceValue.value)
    }

    onSize(size: number) {
        if (size > this.sizeThreshold && this.lastConfirmedSeq !== 0) {
            this.db?.send({
                type: "push",
                action: { "type": "compact", seq: this.lastConfirmedSeq },
                value: { "reset": this.lastConfirmedState },
                key: this.key
            });
        }
    }
}
