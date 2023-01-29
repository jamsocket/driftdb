import React, { useEffect, useRef } from "react";
import { DbConnection } from "driftdb"
import { Api, RoomResult } from "driftdb/dist/api"
import { ConnectionStatus, SequenceValue } from "driftdb/dist/types";

const ROOM_ID_KEY = "_driftdb_room"
const CLIENT_ID_KEY = "_driftdb_client_id"

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

class StateListener<T> {
    lastUpdateSent: number = 0
    lastValue: T | null = null
    debounceTimeout: number | null = null

    constructor(
        private callback: (value: T) => void,
        private db: DbConnection,
        private key: string,
        private debounceMillis: number = 50
    ) {
        this.callback = callback.bind(this)
        this.setStateOptimistic = this.setStateOptimistic.bind(this)
        this.sendUpdate = this.sendUpdate.bind(this)

        db.subscribe(key, (value: SequenceValue) => {
            this.callback(value.value as T)
        })
    }

    onMessage(value: SequenceValue) {
        this.callback(value.value as T)
    }

    sendUpdate() {
        if (this.debounceTimeout !== null) {
            window.clearTimeout(this.debounceTimeout)
            this.debounceTimeout = null
        }
        this.db?.send({
            type: "push",
            action: { "type": "replace" },
            value: this.lastValue,
            key: this.key
        })
    }

    setStateOptimistic(value: T) {
        this.callback(value)

        this.lastValue = value
        const now = performance.now()
        if (now - this.lastUpdateSent < this.debounceMillis) {
            if (this.debounceTimeout === null) {
                this.debounceTimeout = window.setTimeout(this.sendUpdate, this.debounceMillis)
            }
        } else {
            this.lastUpdateSent = now
            this.sendUpdate()
        }
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
        if (sessionStorage.getItem(CLIENT_ID_KEY)) {
            currentId.current = sessionStorage.getItem(CLIENT_ID_KEY)!
        } else {
            currentId.current = crypto.randomUUID()
            sessionStorage.setItem(CLIENT_ID_KEY, currentId.current)
        }
    }
    return currentId.current
}

export function useSharedReducer<T, A>(key: string, reducer: (state: T, action: A) => T, initialValue: T, sizeThreshold: number = 5): [T, (action: A) => void] {
    const db = useDatabase();
    const [state, setState] = React.useState<T>(structuredClone(initialValue));
    const lastConfirmedState = React.useRef<T>(initialValue);
    const lastConfirmedSeq = React.useRef<number>(0);

    const dispatch = (action: any) => {
        const value = reducer(state, action);
        setState(value);
        db?.send({ type: "push", action: { "type": "append" }, value: { "apply": action }, key });
    };

    React.useEffect(() => {
        const callback = (sequenceValue: SequenceValue) => {
            console.log('sv', sequenceValue)
            if (sequenceValue.seq <= lastConfirmedSeq.current!) {
                return;
            }

            const value = sequenceValue.value as any;

            if (value.reset !== undefined) {
                lastConfirmedState.current = value.reset as T;
                lastConfirmedSeq.current = sequenceValue.seq;
                setState(structuredClone(lastConfirmedState.current));
                return;
            }

            if (value.apply !== undefined) {
                lastConfirmedState.current = reducer(lastConfirmedState.current, value.apply as A);
                lastConfirmedSeq.current = sequenceValue.seq;
                setState(structuredClone(lastConfirmedState.current));
                return;
            }

            console.log("Unknown message", sequenceValue.value)
        };
        const sizeCallback = (size: number) => {
            if (size > sizeThreshold && lastConfirmedSeq.current !== null) {
                db?.send({
                    type: "push",
                    action: { "type": "compact", seq: lastConfirmedSeq.current },
                    value: { "reset": lastConfirmedState.current },
                    key
                });
            }
        }

        db?.subscribe(key, callback, sizeCallback);
        return () => {
            db?.unsubscribe(key, callback);
        };
    }, [key]);

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

export function StatusIndicator() {
    const status = useConnectionStatus();

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
                status.connected ? <>{" "}<span><a target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#aaa', fontSize: "70%" }} href={status.debugUrl}>(ui)</a></span></> : null
            }
        </div>
    );
}

interface DriftDBProviderProps {
    children: React.ReactNode
    api: string
}

export function DriftDBProvider(props: DriftDBProviderProps) {
    const dbRef = React.useRef<DbConnection | null>(null);
    if (dbRef.current === null) {
        dbRef.current = new DbConnection();
    }

    React.useEffect(() => {
        let api = new Api(props.api);

        const searchParams = new URLSearchParams(window.location.search);
        let roomId = (
            searchParams.get(ROOM_ID_KEY) ??
            sessionStorage.getItem(ROOM_ID_KEY) ??
            null);

        let promise
        if (roomId) {
            promise = api.getRoom(roomId)
        } else {
            promise = api.newRoom()
        }

        promise.then((result: RoomResult) => {
            let url = new URL(window.location.href);
            url.searchParams.set(ROOM_ID_KEY, result.room);
            window.history.replaceState({}, "", url.toString());

            dbRef.current?.connect(result.socket_url);
        });

        return () => {
            dbRef.current?.disconnect();
        }
    }, []);

    return <DatabaseContext.Provider value={dbRef.current}>{props.children}</DatabaseContext.Provider>;
}
