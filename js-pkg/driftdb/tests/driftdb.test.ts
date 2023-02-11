import { WebSocket } from "ws";
import { DbConnection } from "../src";
import { Api } from "../src/api";

// "localhost" breaks on some versions of node because of this
// https://github.com/nodejs/undici/issues/1248#issuecomment-1214773044
const API_SERVER = "http://127.0.0.1:8080/";

async function connectToNewRoom() {
    let api = new Api(API_SERVER);
    let room = await api.newRoom();
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
    let conn = await connectToNewRoom();

    // Check latency.
    let latency = await conn.testLatency()
    expect(latency).not.toBeUndefined();

    conn.disconnect()
})
