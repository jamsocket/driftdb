import { DbConnection } from ".";
export interface PresenceMessage<T> {
    client: string;
    value: T;
}
export type WrappedPresenceMessage<T> = {
    value: T;
    lastSeen: number;
};
interface PresenceListenerOptions<T> {
    initialState: T;
    db: DbConnection;
    clientId: string;
    key?: string;
    callback?: (presence: Record<string, WrappedPresenceMessage<T>>) => void;
    minPresenceInterval?: number;
    maxPresenceInterval?: number;
}
export declare class PresenceListener<T> {
    private state;
    private key;
    private clientId;
    private db;
    private callback;
    private presence;
    private interval;
    private minPresenceInterval;
    private maxPresenceInterval;
    private lastUpdate;
    private nextUpdate;
    private updateHandle;
    constructor(options: PresenceListenerOptions<T>);
    destroy(): void;
    private onMessage;
    private update;
    updateState(value: T): void;
}
export {};
//# sourceMappingURL=presence.d.ts.map