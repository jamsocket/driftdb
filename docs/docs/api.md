---
sidebar_position: 3
---

# API

A DriftDB instance is represented by a URL that points to the root path to its API. For a [Jamsocket.Live](https://jamsocket.live) instance, this looks like `https://api.jamsocket.live/db/<YOUR_ACCESS_KEY_HERE>`. For a local dev instance, it may be `http://localhost:8000`.

All API endpoints below are relative to this root path.

## Rooms

Create a room by sending a `POST` request to `/new`. It returns a JSON object with the following fields:

- `room`: random string uniqely representing the new room (string).
- `socket_url`: WebSocket URL to connect to the room for real-time reads and write (string).
- `http_url`: HTTP URL to send messages to the room from non-WebSocket clients (string).

Given a `room` ID returned by `/new`, you can receive the same JSON object by sending a `GET` request to `/room/<ROOM_ID>`.

## Socket API

The `socket_url` returned by `/new` is unique to a room. When the client opens a WebSocket connection to that URL, it is automatically subscribed to all broadcast messages in that room.

The client sends and receives data from the server as WebSocket text payloads containing JSON.

### Receiving Broadcast Messages

Here’s an example message from the server that tells the client that a message with the value `104` was sent to the key `slider`. The server assigned this message a sequence number of `6`.

```json
{
    "key": "slider",
    "seq": 6,
    "type": "push",
    "value": 104
}
```

### Sending Messages

The client can send messages by sending the server a message like this:

```json
{
    "action": {"type": "replace"},
    "key": "slider",
    "type": "push",
    "value": 55
}
```

Note that the client does not include a sequence number (`seq`) since that is set by the DriftDB server upon receiving the message. The client also includes an `action`, which tells DriftDB how the message should modify the stream, if at all. In this example, `replace` tells DriftDB to replace the entire content of the `"slider"` stream with the single value 55.

This means that if a client connects for the first time, or is offline when this message is broadcast, they will be able to retrieve this message from DriftDB, but not prior messages on the `"slider"` stream.

### Message Actions

Actions are represented as JSON objects, with a mandatory value `type`. The action type `compact` also has a field, `seq`.

Actions determine two things:
- How DriftDB updates its internal state of the stream.
- Whether DriftDB broadcasts the message to connected clients.

DriftDB provides four actions:
- `{"type": "relay"}`: broadcast the message, do not update the internal stream state.
- `{"type": "replace"}`: broadcast the message, replace the entire stream state.
- `{"type": "append"}`: broadcast the message, add it to the end of the stream.
- `{"type": "compact", "seq": <number>}`: do not broadcast the message, remove all messages less than or equal to `seq` from the stream, prepend the message to the beginning of the stream and give it the sequence number `seq`.

If an action increased the length of a stream, the server will send the client who sent the message (and only that client) a message like this:

```json
{
    "type": "stream_size",
    "key": "counter",
    "size": 3
}
```

The client may use this to trigger a compaction when the stream size surpasses a threshold, if appropriate.

### Getting messages

Clients can ask the server for messages on the stream of a given key, specifying a sequence number to start from.

The message from the client looks like this:

```json
{
    "key": "my-stream",
    "seq": 0,
    "type": "get"
}
```

All messages with a sequence number strictly greater than the one provided are returned. The first message in each room is given the sequence number 1, so setting this to 0 will return every message in a stream retained by DriftDB.

The server will respond to a `get` message with an `init` message like this:

```json
{
    "type": "init",
    "key": "my-stream",
    "data": [
        {
            "value": "abc",
            "seq": 5
        },
        {
            "value": "def",
            "seq": 8
        }
    ]
}
```

The type of the `value` fields (here shown as strings) is determined by your application, and can be any JSON type.

Data will be in increasing order of sequence number, but there may be gaps, since the sequence number in a room is global across all keys and a stream only represents one of those keys.

## Messaging over HTTP

In some situations, you just want to send messages or use DriftDB as a key/value store and do not need the complexity of a long-lived WebSocket connection. DriftDB provides a way to send and receive messages over HTTP.

Messages over HTTP have the same JSON schema as messages over WebSocket. They can be sent in a `POST` request to the `http_url` endpoint returned by `/new`.
