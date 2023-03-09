import { DbConnection } from "./index";
import { SequenceValue } from "./types";
export declare class StateListener<T> {
    private callback;
    private db;
    private key;
    private debounceMillis;
    lastUpdateSent: number;
    lastValue: T | null;
    debounceTimeout: number | null;
    state: T | null;
    constructor(callback: (value: T) => void, db: DbConnection, key: string, debounceMillis?: number);
    onMessage(value: SequenceValue): void;
    sendUpdate(): void;
    setStateOptimistic(value: T): void;
}
//# sourceMappingURL=state.d.ts.map