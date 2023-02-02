import React, { useEffect, useRef, useState } from "react";
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

interface PresenceMessage<T> {
    client: string
    value: T
}

type WrappedPresenceMessage<T> = {
    value: T,
    lastSeen: number
}

const MIN_PRESENCE_INTERVAL = 100
const MAX_PRESENCE_INTERVAL = 1_000

class PresenceListener<T> {
    // Time of the last update caused by a state change (not regular interval).
    private lastUpdate = 0
    
    // True if we have a pending update.
    private nextUpdate: number

    private updateHandle: ReturnType<typeof setTimeout>

    constructor(private state: T, private db: DbConnection, private key: string, private clientId: string) {
        this.nextUpdate = Date.now()

        this.updateHandle = setTimeout(() => {            
            this.update()
        }, 0)
    }

    private update() {
        this.db.send({
            type: "push",
            action: { type: "relay" },
            value: { value: this.state, client: this.clientId },
            key: this.key
        })

        this.nextUpdate = Date.now() + MAX_PRESENCE_INTERVAL
        this.lastUpdate = Date.now()
        this.updateHandle = setTimeout(() => {
            this.update()
        }, MAX_PRESENCE_INTERVAL)        
    }

    updateState(value: T) {
        if (JSON.stringify(value) === JSON.stringify(this.state)) {
            return
        }

        this.state = value
        
        const nextUpdate = this.lastUpdate + MIN_PRESENCE_INTERVAL

        if (nextUpdate < this.nextUpdate) {
            this.nextUpdate = nextUpdate
            clearTimeout(this.updateHandle)
            this.updateHandle = setTimeout(() => {
                this.update()
            }, this.nextUpdate - Date.now())
        }
    }
}

export function usePresence<T>(key: string, value: T): Record<string, WrappedPresenceMessage<T>> {
    const db = useDatabase()
    const clientId = useUniqueClientId()
    const [presence, setPresence] = useState<Record<string, WrappedPresenceMessage<T>>>({})
    
    const presenceListener = useRef<PresenceListener<T>>()
    if (presenceListener.current === undefined) {
        presenceListener.current = new PresenceListener(value, db, key, clientId)
    }

    presenceListener.current.updateState(value)
    
    React.useEffect(() => {
        const callback = (event: SequenceValue) => {
            let message: PresenceMessage<T> = event.value as any
            if (message.client === clientId) {
                // Ignore our own messages.
                return
            }

            setPresence((presence) => ({...presence, [message.client]: {
                value: message.value,
                lastSeen: Date.now()
            }}))
        }

        const interval = setInterval(() => {
            setPresence((presence) => {
                let newPresence: Record<string, WrappedPresenceMessage<T>> = {}
                for (let client in presence) {
                    if (Date.now() - presence[client].lastSeen < MAX_PRESENCE_INTERVAL * 2) {
                        newPresence[client] = presence[client]
                    }
                }
                return newPresence
            })
        }, MAX_PRESENCE_INTERVAL)

        db.subscribe(key, callback)

        return () => {
            db.unsubscribe(key, callback)
            clearInterval(interval)
        }
    }, [key])

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
