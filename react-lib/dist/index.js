"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriftDBProvider = exports.StatusIndicator = exports.useConnectionStatus = exports.useSharedReducer = exports.useUniqueClientId = exports.useSharedState = exports.RoomQRCode = exports.useDatabase = exports.DatabaseContext = void 0;
const react_1 = __importStar(require("react"));
const driftdb_1 = require("driftdb");
const api_1 = require("driftdb/dist/api");
const ROOM_ID_KEY = "_driftdb_room";
const CLIENT_ID_KEY = "_driftdb_client_id";
exports.DatabaseContext = react_1.default.createContext(null);
function useDatabase() {
    const db = react_1.default.useContext(exports.DatabaseContext);
    if (db === null) {
        throw new Error("useDatabase must be used within a DriftDBProvider");
    }
    return db;
}
exports.useDatabase = useDatabase;
function RoomQRCode() {
    const db = useDatabase();
    const [pageUrl, setPageUrl] = react_1.default.useState(null);
    (0, react_1.useEffect)(() => {
        const callback = () => {
            if (typeof window === "undefined") {
                return;
            }
            const url = new URL(window.location.href);
            const checkRoom = url.searchParams.get(ROOM_ID_KEY);
            if (!checkRoom) {
                return;
            }
            setPageUrl(window.location.href);
            return () => {
                db.statusListener.removeListener(callback);
            };
        };
        db.statusListener.addListener(callback);
    }, [db]);
    if (pageUrl) {
        return react_1.default.createElement("img", { src: `https://api.jamsocket.live/qrcode?url=${pageUrl}` });
    }
    else {
        return null;
    }
}
exports.RoomQRCode = RoomQRCode;
class StateListener {
    constructor(callback, db, key, debounceMillis = 50) {
        this.callback = callback;
        this.db = db;
        this.key = key;
        this.debounceMillis = debounceMillis;
        this.lastUpdateSent = 0;
        this.lastValue = null;
        this.debounceTimeout = null;
        this.callback = callback.bind(this);
        this.setStateOptimistic = this.setStateOptimistic.bind(this);
        this.sendUpdate = this.sendUpdate.bind(this);
        db.subscribe([key], (value) => {
            this.callback(value.value);
        });
    }
    onMessage(value) {
        this.callback(value.value);
    }
    sendUpdate() {
        this.debounceTimeout = null;
        this.db?.send({
            type: "push",
            action: { "type": "replace" },
            value: this.lastValue,
            key: [this.key]
        });
    }
    setStateOptimistic(value) {
        this.callback(value);
        this.lastValue = value;
        const now = performance.now();
        if (now - this.lastUpdateSent < this.debounceMillis) {
            if (this.debounceTimeout === null) {
                this.debounceTimeout = window.setTimeout(this.sendUpdate, this.debounceMillis);
            }
        }
        else {
            this.lastUpdateSent = now;
            this.sendUpdate();
        }
    }
}
function useSharedState(key, initialValue) {
    const db = useDatabase();
    const [state, setState] = react_1.default.useState(initialValue);
    let stateListener = (0, react_1.useRef)(null);
    if (stateListener.current === null) {
        stateListener.current = new StateListener(setState, db, key);
    }
    return [state, stateListener.current.setStateOptimistic];
}
exports.useSharedState = useSharedState;
function useUniqueClientId() {
    const currentId = (0, react_1.useRef)();
    if (typeof window === "undefined") {
        return null;
    }
    if (!currentId.current) {
        if (sessionStorage.getItem(CLIENT_ID_KEY)) {
            currentId.current = sessionStorage.getItem(CLIENT_ID_KEY);
        }
        else {
            currentId.current = crypto.randomUUID();
            sessionStorage.setItem(CLIENT_ID_KEY, currentId.current);
        }
    }
    return currentId.current;
}
exports.useUniqueClientId = useUniqueClientId;
function useSharedReducer(key, reducer, initialValue, sizeThreshold = 5) {
    const db = useDatabase();
    const [state, setState] = react_1.default.useState(structuredClone(initialValue));
    const lastConfirmedState = react_1.default.useRef(initialValue);
    const lastConfirmedSeq = react_1.default.useRef(0);
    const dispatch = (action) => {
        const value = reducer(state, action);
        setState(value);
        db?.send({ type: "push", action: { "type": "append" }, value: { "apply": action }, key: [key] });
    };
    react_1.default.useEffect(() => {
        const callback = (sequenceValue) => {
            if (sequenceValue.seq <= lastConfirmedSeq.current) {
                return;
            }
            if (sequenceValue.value.reset !== undefined) {
                lastConfirmedState.current = sequenceValue.value.reset;
                lastConfirmedSeq.current = sequenceValue.seq;
                setState(structuredClone(lastConfirmedState.current));
                return;
            }
            if (sequenceValue.value.apply !== undefined) {
                lastConfirmedState.current = reducer(lastConfirmedState.current, sequenceValue.value.apply);
                lastConfirmedSeq.current = sequenceValue.seq;
                setState(structuredClone(lastConfirmedState.current));
                return;
            }
            console.log("Unknown message", sequenceValue.value);
        };
        const sizeCallback = (size) => {
            if (size > sizeThreshold && lastConfirmedSeq.current !== null) {
                db?.send({
                    type: "push",
                    action: { "type": "compact", seq: lastConfirmedSeq.current },
                    value: { "reset": lastConfirmedState.current },
                    key: [key]
                });
            }
        };
        db?.subscribe([key], callback, sizeCallback);
        return () => {
            db?.unsubscribe([key], callback);
        };
    }, [db, key, reducer, sizeThreshold]);
    return [state, dispatch];
}
exports.useSharedReducer = useSharedReducer;
function useConnectionStatus() {
    const db = useDatabase();
    const [status, setStatus] = react_1.default.useState({ connected: false });
    react_1.default.useEffect(() => {
        const callback = (event) => {
            setStatus(event);
        };
        db?.statusListener.addListener(callback);
        return () => {
            db?.statusListener.removeListener(callback);
        };
    }, [db]);
    return status;
}
exports.useConnectionStatus = useConnectionStatus;
function StatusIndicator() {
    const status = useConnectionStatus();
    let color;
    if (status.connected) {
        color = "green";
    }
    else {
        color = "red";
    }
    return (react_1.default.createElement("div", { style: { display: 'inline-block', border: '1px solid #ccc', background: '#eee', borderRadius: 10, padding: 10 } },
        "DriftDB status: ",
        react_1.default.createElement("span", { style: { color, fontWeight: 'bold' } }, status.connected ? "Connected" : "Disconnected"),
        status.connected ? react_1.default.createElement(react_1.default.Fragment, null,
            " ",
            react_1.default.createElement("span", null,
                react_1.default.createElement("a", { target: "_blank", rel: "noreferrer", style: { textDecoration: 'none', color: '#aaa', fontSize: "70%" }, href: status.debugUrl }, "(ui)"))) : null));
}
exports.StatusIndicator = StatusIndicator;
function DriftDBProvider(props) {
    const dbRef = react_1.default.useRef(null);
    if (dbRef.current === null) {
        dbRef.current = new driftdb_1.DbConnection();
    }
    react_1.default.useEffect(() => {
        let api = new api_1.Api(props.api);
        const searchParams = new URLSearchParams(window.location.search);
        let roomId = (searchParams.get(ROOM_ID_KEY) ??
            sessionStorage.getItem(ROOM_ID_KEY) ??
            null);
        let promise;
        if (roomId) {
            promise = api.getRoom(roomId);
        }
        else {
            promise = api.newRoom();
        }
        promise.then((result) => {
            let url = new URL(window.location.href);
            url.searchParams.set(ROOM_ID_KEY, result.room);
            window.history.replaceState({}, "", url.toString());
            dbRef.current?.connect(result.url);
        });
        return () => {
            dbRef.current?.disconnect();
        };
    }, []);
    return react_1.default.createElement(exports.DatabaseContext.Provider, { value: dbRef.current }, props.children);
}
exports.DriftDBProvider = DriftDBProvider;
