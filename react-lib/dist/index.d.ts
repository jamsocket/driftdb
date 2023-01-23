import React from "react";
import { DbConnection } from "driftdb";
import { ConnectionStatus } from "driftdb/dist/types";
export declare const DatabaseContext: React.Context<DbConnection | null>;
export declare function useDatabase(): DbConnection;
export declare function RoomQRCode(): JSX.Element | null;
export declare function useSharedState<T>(key: string, initialValue: T): [T, (value: T) => void];
export declare function useUniqueClientId(): string;
export declare function useSharedReducer<T, A>(key: string, reducer: (state: T, action: A) => T, initialValue: T, sizeThreshold?: number): [T, (action: A) => void];
export declare function useConnectionStatus(): ConnectionStatus;
export declare function StatusIndicator(): JSX.Element;
interface DriftDBProviderProps {
    children: React.ReactNode;
    api: string;
}
export declare function DriftDBProvider(props: DriftDBProviderProps): JSX.Element;
export {};
