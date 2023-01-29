---
sidebar_position: 3
---

# API

A DriftDB instance is represented by a URL that points to the root path to its API. For a Jamsocket.live instance, this looks like `https://api.jamsocket.live/db/<YOUR_ACCESS_KEY_HERE>`. For a local dev instance, it may be `http://localhost:8000`.

All API endpoints below are relative to this root path.

## Rooms

Create a room by sending a `POST` request to `/new`. It returns a JSON object with the following fields:

- `room`: random string uniqely representing the new room (string).
- `socket_url`: WebSocket URL to connect to the room for real-time reads and write (string).
- `http_url`: HTTP URL to send messages to the room from non-WebSocket clients (string).

Given a `room` ID returned by `/new`, you can receive the same JSON object by sending a `GET` request to `/room/<ROOM_ID>`.

## Socket API

The `socket_url` returned by `/new` is unique to a room. When the client opens a WebSocket connection to that URL, any messages broadcast within that room are automatically sent to the client as JSON.

Here’s an example message that tells the client that a message with the value `104` was sent to the key `slider`. DriftDB assigned this message a sequence number of `6`.

```json
{"type": "push", "key": "slider", "value": {"value": 104, "seq": 6}}
```

The client can update messages by sending messages like this:

```json
{"type": "push", "action": {"type": "replace"}, "value": 55, "key": "slider"}
```

Note that 
