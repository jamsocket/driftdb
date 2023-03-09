import { ConnectionStatus, MessageFromDb, MessageToDb, SequenceValue, Key } from "./types";
export { PresenceListener } from "./presence";
export type { WrappedPresenceMessage, PresenceMessage } from "./presence";
export { StateListener } from "./state";
export { Reducer } from "./reducer";
export { Api } from "./api";
export type { RoomResult } from "./api";
export { HttpConnection } from "./http";
export declare class EventListener<T> {
    listeners: Array<(event: T) => void>;
    addListener(listener: (event: T) => void): void;
    removeListener(listener: (event: T) => void): void;
    dispatch(event: T): void;
}
export declare class SubscriptionManager<T> {
    subscriptions: Map<string, EventListener<T>>;
    subscribe(key: Key, listener: (event: T) => void): void;
    unsubscribe(subject: Key, listener: (event: T) => void): void;
    dispatch(key: Key, event: T): void;
}
export declare class DbConnection {
    connection: WebSocket | null;
    status: ConnectionStatus;
    statusListener: EventListener<ConnectionStatus>;
    messageListener: EventListener<MessageFromDb>;
    subscriptions: SubscriptionManager<SequenceValue>;
    sizeSubscriptions: SubscriptionManager<number>;
    private queue;
    private dbUrl;
    private reconnectLoopHandle;
    private activeLatencyTest;
    private cbor;
    connect(dbUrl: string, cbor?: boolean): Promise<void>;
    testLatency(): Promise<number> | null;
    private debugUrl;
    disconnect(): void;
    setStatus(connected: boolean): void;
    send(message: MessageToDb): void;
    subscribe(key: Key, listener: (event: SequenceValue) => void, sizeCallback?: (size: number) => void): void;
    unsubscribe(subject: Key, listener: (event: SequenceValue) => void, sizeCallback?: (size: number) => void): void;
}
export declare function uniqueClientId(): string;
//# sourceMappingURL=index.d.ts.map