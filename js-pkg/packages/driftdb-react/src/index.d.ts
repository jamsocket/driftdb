import React from "react";
import { DbConnection, WrappedPresenceMessage } from "driftdb";
import { ConnectionStatus } from "driftdb/dist/types";
export declare const DatabaseContext: React.Context<DbConnection | null>;
export declare function useDatabase(): DbConnection;
export declare function RoomQRCode(): JSX.Element | null;
type SetterFunction<T> = (value: T | ((v: T) => T)) => void;
export declare function useSharedState<T>(key: string, initialValue: T): [T, SetterFunction<T>];
export declare function useUniqueClientId(): string;
export declare function useSharedReducer<State, Action>(key: string, reducer: (state: State, action: Action) => State, initialValue: State): [State, (action: Action) => void];
export declare function useSharedReducer<State, Action, InitialValue>(key: string, reducer: (state: State, action: Action) => State, initialValue: InitialValue, init: (initialValue: InitialValue) => State): [State, (action: Action) => void];
export declare function useConnectionStatus(): ConnectionStatus;
export declare function useLatency(): number | null;
export declare function usePresence<T>(key: string, value: T): Record<string, WrappedPresenceMessage<T>>;
export declare function StatusIndicator(): JSX.Element;
interface DriftDBProviderProps {
    children: React.ReactNode;
    api: string;
    room?: string;
    crdt?: boolean;
}
export declare function DriftDBProvider(props: DriftDBProviderProps): JSX.Element;
export {};
//# sourceMappingURL=index.d.ts.map