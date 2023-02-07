import React, { useEffect, useRef, useState } from "react";
import { DbConnection, PresenceListener, Reducer, StateListener, uniqueClientId, WrappedPresenceMessage } from "driftdb"
import { Api, RoomResult } from "driftdb/dist/api"
import { ConnectionStatus } from "driftdb/dist/types";

const ROOM_ID_KEY = "_driftdb_room"

export const DatabaseContext = React.createContext<DbConnection | null>(null);

export function useDatabase(): DbConnection {
    const db = React.useContext(DatabaseContext);
    if (db === null) {
        throw new Error("useDatabase must be used within a DriftDBProvider");
    }
    return db;
}

export function RoomQRCode() {
    const db = useDatabase();
    const [pageUrl, setPageUrl] = React.useState<string | null>(null)

    useEffect(() => {
        const callback = () => {
            if (typeof window === "undefined") {
                return
            }

            const url = new URL(window.location.href)
            const checkRoom = url.searchParams.get(ROOM_ID_KEY)

            if (!checkRoom) {
                return
            }

            setPageUrl(window.location.href)

            return () => {
                db.statusListener.removeListener(callback)
            }
        }

        db.statusListener.addListener(callback)
    }, [db])

    if (pageUrl) {
        return <img src={`https://api.jamsocket.live/qrcode?url=${pageUrl}`} />
    } else {
        return null
    }
}

export function useSharedState<T>(key: string, initialValue: T): [T, (value: T) => void] {
    const db = useDatabase();
    const [state, setState] = React.useState<T>(initialValue);

    let stateListener = useRef<StateListener<T>>(null)
    if (stateListener.current === null) {
        (stateListener as any).current = new StateListener(setState, db, key)
    }

    return [state, stateListener.current!.setStateOptimistic];
}

export function useUniqueClientId(): string {
    const currentId = useRef<string>()

    if (typeof window === "undefined") {
        return null!
    }

    if (!currentId.current) {
       currentId.current = uniqueClientId()
    }
    return currentId.current
}

export function useSharedReducer<T, A>(key: string, reducer: (state: T, action: A) => T, initialValue: T, sizeThreshold?: number): [T, (action: A) => void] {
    const db = useDatabase();
    const [state, setState] = React.useState<T>(structuredClone(initialValue));

    const reducerRef = React.useRef<Reducer<T, A> | null>(null)
    if (reducerRef.current === null) {
        reducerRef.current = new Reducer({
            key,
            reducer,
            initialValue,
            sizeThreshold,
            db,
            callback: setState
        })
    }

    const dispatch = reducerRef.current.dispatch;

    return [state, dispatch];
}

export function useConnectionStatus(): ConnectionStatus {
    const db = useDatabase();
    const [status, setStatus] = React.useState<ConnectionStatus>({ connected: false });

    React.useEffect(() => {
        const callback = (event: ConnectionStatus) => {
            setStatus(event);
        };
        db?.statusListener.addListener(callback);
        return () => {
            db?.statusListener.removeListener(callback);
        };
    }, [db]);

    return status;
}

export function useLatency(): number | null {
    const db = useDatabase();
    const [latency, setLatency] = useState<number | null>(null!);

    React.useEffect(() => {
        const updateLatency = async () => {
            const result = await db?.testLatency();
            setLatency(result);
        }

        const interval = setInterval(updateLatency, 5000);
        updateLatency();

        return () => {
            clearInterval(interval);
        }
    }, [db]);

    return latency;
}

export function usePresence<T>(key: string, value: T): Record<string, WrappedPresenceMessage<T>> {
    const db = useDatabase()
    const clientId = useUniqueClientId()
    const [presence, setPresence] = useState<Record<string, WrappedPresenceMessage<T>>>({})
    
    const presenceListener = useRef<PresenceListener<T>>()
    if (presenceListener.current === undefined) {
        presenceListener.current = new PresenceListener({
            key,
            db,
            clientId,
            initialState: value,
            callback: setPresence,
        })
    }

    presenceListener.current.updateState(value)
    
    return presence
}

export function StatusIndicator() {
    const status = useConnectionStatus();
    const latency = useLatency();
    const latencyStr = latency === null ? "..." : Math.round(latency).toString();

    let color
    if (status.connected) {
        color = "green"
    } else {
        color = "red"
    }

    return (
        <div style={{ display: 'inline-block', border: '1px solid #ccc', background: '#eee', borderRadius: 10, padding: 10 }}>
            DriftDB status: <span style={{ color, fontWeight: 'bold' }}>{status.connected ? "Connected" : "Disconnected"}</span>
            {
                status.connected ? <>
                    {" "}<span style={{fontSize: '70%', color: '#aaa'}}>
                        <a target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#aaa' }} href={status.debugUrl}>(ui)</a>
                        ({latencyStr}ms)
                    </span>
                </> : null
            }
        </div>
    );
}

interface DriftDBProviderProps {
    children: React.ReactNode
    api: string
    room?: string
}

export function DriftDBProvider(props: DriftDBProviderProps) {
    const dbRef = useRef<DbConnection | null>(null);
    if (dbRef.current === null) {
        dbRef.current = new DbConnection();
    }

    React.useEffect(() => {
        let api = new Api(props.api);

        let roomId
        if (props.room) {
            roomId = props.room
        } else {
            const searchParams = new URLSearchParams(window.location.search)
            roomId = searchParams.get(ROOM_ID_KEY)
        }

        let promise
        if (roomId) {
            promise = api.getRoom(roomId)
        } else {
            promise = api.newRoom()
        }

        promise.then((result: RoomResult) => {
            if (!props.room) {
                let url = new URL(window.location.href);
                url.searchParams.set(ROOM_ID_KEY, result.room);
                window.history.replaceState({}, "", url.toString());
            }

            dbRef.current?.connect(result.socket_url);
        });

        return () => {
            dbRef.current?.disconnect();
        }
    }, []);

    return <DatabaseContext.Provider value={dbRef.current}>{props.children}</DatabaseContext.Provider>;
}
