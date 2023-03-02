import { DbConnection, StateListener, Api, RoomResult } from "driftdb";
import { expect, test } from "bun:test";

// "localhost" breaks on some versions of node because of this
// https://github.com/nodejs/undici/issues/1248#issuecomment-1214773044
const API_SERVER = "http://127.0.0.1:8080/";

class CallbackExpecter<T> {
    private resolve: ((v: T) => void) | null = null
    private reject: ((err: any) => void) | null = null
    private nextValue: T | null = null
    private timeout: ReturnType<typeof setTimeout> | null = null

    expect(message: string, timeoutMillis = 5_000): Promise<T> {
        if (this.nextValue) {
            const value = this.nextValue
            this.nextValue = null
            return Promise.resolve(value)
        }

        if (this.resolve) {
            throw new Error("CallbackExpecter already has an expect call outstanding.");
        }

        return new Promise((resolve, reject) => {
            this.timeout = setTimeout(() => {
                reject(new Error(`${message} out.`));
            }, timeoutMillis);
            this.reject = reject;
            this.resolve = resolve;
        });
    }

    accept = (value: T) => {
        if (this.timeout) {
            clearTimeout(this.timeout as any as number);
            this.timeout = null;
        }
        if (this.resolve) {
            this.resolve(value);
            this.resolve = null;
            this.reject = null;
        } else {
            this.nextValue = value;
        }
    }
}

async function connectToNewRoom(): Promise<{ db: DbConnection, room: RoomResult }> {
    let api = new Api(API_SERVER);
    let room = await api.newRoom();
    let db = new DbConnection();
    await db.connect(room.socket_url);
    return {db, room};
}

async function connectToRoom(room: RoomResult): Promise<DbConnection> {
    let db = new DbConnection();
    await db.connect(room.socket_url);
    return db;
}

test("Test room creation.", async () => {
    let api = new Api(API_SERVER);

    // Create a new room.
    let room = await api.newRoom();
    expect(room.room).not.toBeUndefined();
    expect(room.socket_url).not.toBeUndefined();
    expect(room.http_url).not.toBeUndefined();

    // If we access the same room, we should get the same result.
    let room2 = await api.getRoom(room.room);
    expect(room2.room).toEqual(room.room);
    expect(room2.socket_url).toEqual(room.socket_url);
    expect(room2.http_url).toEqual(room.http_url);

    let room3 = await api.newRoom();
    expect(room3.room).not.toEqual(room.room);
    expect(room3.socket_url).not.toEqual(room.socket_url);
    expect(room3.http_url).not.toEqual(room.http_url);
})

test("Test connecting and checking latency.", async () => {
    let {db} = await connectToNewRoom();

    // Check latency.
    let latency = await db.testLatency()
    expect(latency).not.toBeUndefined();

    db.disconnect()
})

test("Test optimistic set and get.", async () => {
    let {db} = await connectToNewRoom();

    let expecter = new CallbackExpecter<string>();
    let stateListener = new StateListener(expecter.accept, db, "key")

    stateListener.setStateOptimistic("foo")
    let result = await expecter.expect("Optimistic set not received.")
    expect(result).toEqual("foo")

    db.disconnect()
})

test("Test optimistic set and get.", async () => {
    let {db, room} = await connectToNewRoom();
    let db2 = await connectToRoom(room);

    let expecter = new CallbackExpecter<string>();
    let stateListener = new StateListener(expecter.accept, db, "key")

    let expecter2 = new CallbackExpecter<string>();
    new StateListener(expecter2.accept, db2, "key")

    stateListener.setStateOptimistic("foo")
    let result = await expecter.expect("Optimistic set not received.")
    expect(result).toEqual("foo")

    let result2 = await expecter2.expect("State set not received.")
    expect(result2).toEqual("foo")

    db.disconnect()
    db2.disconnect()
})

