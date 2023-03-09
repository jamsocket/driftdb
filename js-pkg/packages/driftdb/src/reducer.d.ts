import { DbConnection } from ".";
import { SequenceValue } from "./types";
export interface ReducerOpts<T, A> {
    /** A key identifying the stream to use for the reducer. */
    key: string;
    /** The reducer function applied when dispatch is called. */
    reducer: (state: T, action: A) => T;
    /** The initial state passed to the reducer. */
    initialValue: T;
    /** The number of messages to keep in the stream before compacting. */
    sizeThreshold?: number;
    /** The database connection to use. */
    db: DbConnection;
    /** A callback function called when the state changes, either because of a local call to dispatch or a remote event. */
    callback: (state: T) => void;
}
export declare class Reducer<T, A> {
    state: any;
    lastConfirmedState: any;
    lastConfirmedSeq: number;
    db: DbConnection;
    reducer: (state: any, action: any) => any;
    key: string;
    callback: (state: T) => void;
    sizeThreshold: number;
    constructor(opts: ReducerOpts<T, A>);
    dispose(): void;
    dispatch(action: A): void;
    onSequenceValue(sequenceValue: SequenceValue): void;
    onSize(size: number): void;
}
//# sourceMappingURL=reducer.d.ts.map