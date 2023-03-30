---
sidebar_position: 8
---

# JavaScript interface

DriftDB provides a vanilla JavaScript API. This provides the underlying interface that we use for
[DriftDB-React](/docs/react), but it can also be used directly by applications.

The JavaScript API provides a low-level subscription interface, which calls a provided callback every
time a message is received on a particular key. It also provides some higher-level data synchronization
patterns.

The same application may use both the low-level and high-level interfaces, although generally you should not
use both a high-level interface and low-level subscription on the same key.

Before using the low-level API, we recommend reading the [data model](/docs/data-model) documentation.

## Installation

Install `DriftDB` using `npm`:

```bash
npm i driftdb
```

To get started with DriftDB-React, you will need the URL of a running DriftDB server. Either follow [the instructions](https://github.com/drifting-in-space/driftdb/blob/main/driftdb-worker/README.md) to run a server of your own, or sign up at [Jamsocket.live](https://jamsocket.live) for a free hosted instance.

## Importing

Import the `DbConnection` and `Api` classes, as needed:

```typescript
import { DbConnection } from 'driftdb'
import { Api } from "driftdb/dist/api"
```

## Obtaining a room

Every connection to a DriftDB server is scoped to a particular **room**, as described in the [data model](/docs/data-model) documentation.

The DriftDB server provides a way of creating a room, which is wrapped in the `Api` class. The `Api` class must first be constructed by providing the URL of a DriftDB server, like so:

```typescript
const api = new Api('https://jamsocket.live/db/[YOUR_KEY]')
```

To create a new room, call `api.newRoom()`:

```typescript
const room = await api.newRoom()
```

The value of `room` will be a JavaScript object like this:

```typescript
{
    room: "8hX8d0Q7bTWf2sKKr9c4Qmcj",
    http_url: "https://api.jamsocket.live/room/8hX8d0Q7bTWf2sKKr9c4Qmcj/",
    socket_url: "wss://api.jamsocket.live/room/8hX8d0Q7bTWf2sKKr9c4Qmcj/connect"
}
```

- `room` is a unique ID for the room. It is the value that should be shared with other clients to connect
them to the same room.
- `http_url` is an endpoint for sending one-off messages to the room without establishing a connection.
It is not used by the JavaScript client API, but is useful in environments where a WebSocket client is not
available but an HTTP client is.
- `socket_url` is a WebSocket URL for connecting to the database. This is the value you need to connect via
a `DbConnection` (see below).

You can send the value of `room` to another client so that that client can connect to the same room. That
client can then use `api.getRoom()` to obtain the same object returned by `newRoom()` on the original
client:

```typescript
const room = await api.getRoom('8hX8d0Q7bTWf2sKKr9c4Qmcj')
const socketUrl = room['socket_url']
```

To place multiple clients in the same room, you will need a way to share the room ID with all of them. One
way to do this is to embed the room ID in the URL. The React client has a [simple implementation of this](https://github.com/drifting-in-space/driftdb/blob/4d00d3902ec0812452c0fbb8c0d79e582959dab7/js-pkg/driftdb-react/src/index.tsx#L215-L240) that may provide inspiration.

## Connecting to a room

To connect to a database, first construct a `DbConnection`:

```typescript
const conn = new DbConnection()
```

Then, pass the WebSocket URL of a DriftDB instance (the `socket_url` field of an object returned by `newRoom` or `getRoom` above) into the `DbConnection` via `connect()`:

```typescript
conn.connect('wss://api.jamsocket.live/room/8hX8d0Q7bTWf2sKKr9c4Qmcj/connect')
```

Connection happens in the background. You can test whether a `DbConnection` is connected by checking
`conn.status.connected`, which is `true` when a connection has been established. A `DbConnection` will
automatically reconnect if it is disconnected, and will queue up messages to send to the server while
offline.

## Subscriptions

Data is accessed in DriftDB via subscriptions. A subscription is created by providing a key (string)
and a callback function. The callback will be called for every message in the stream associated with the
given key.

When a subscription is first created, the client retrieves all of the messages the server
has retained on that stream and calls the callback on each of them. Then, as new messages arrive, the
client calls the callback on each. The callback is always called on messages in the order they appear
in the stream.

To create a subscription:

```typescript
conn.subscribe("my-key", (d) => console.log('received on my-key', d))
```

## Sending

To send messages, use `conn.send`:

```typescript
conn.send({
    type: "push", // send a message.
    action: {type: "append"}, // append retains the message in the stream
    // see /data-model for actions
    value: "my-value", // any JSON-serializable value is allowed here
    key: "my-key"
})
```

Every other client in the same room that has installed a callback for `my-key` will run that callback
on the value `my-value`. Since the `action` is `append`, the message will be appended to the server’s
retained stream for `my-key`, so even clients that connect later will receive the message.

Combined with the example subscription above, the message would result in every client logging the following
to the console:

```
received on my-key: my-value
```

## Higher-level state patterns

The JavaScript library provides a number of higher-level state sharing patterns:

- `PresenceListener` as a basis for ephemeral shared presence messages (e.g. cursor position, avatar stacks)
- `Reducer` for state machine synchronization with compaction
- `StateListener` for a shared value with client-side throttling

These are not yet documented, but the [`DriftDB-React` code](https://github.com/drifting-in-space/driftdb/blob/main/js-pkg/driftdb-react/src/index.tsx) provides example usage of each.
