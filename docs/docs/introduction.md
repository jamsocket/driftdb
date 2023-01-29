---
sidebar_position: 2
---

# Introduction

DriftDB is a WebSocket message relay. You can use it for exchanging data between clients that can speak WebSocket or HTTP, even if they can’t connect to each other directly.

All messages in DriftDB are scoped to a **room**, which is a sort of broadcast channel. DriftDB provides an API for creating rooms. Clients specify the room they are joining when they connect to DriftDB.

Once connected, clients can send messages (arbitrary JSON payloads), which will be relayed to all clients currently connected to that room. Messages broadcast by DriftDB are [totally ordered](https://en.wikipedia.org/wiki/Atomic_broadcast) and assigned a sequence number, which is unique and sequential within a given room.

## Message Replay

It can be useful to be able to replay messages that a client missed, either because the client first connected after the message was sent, or the client got disconnected and now wants to catch back up. But the client might not need *every* message they missed, since a newer message may obviate an older one.

DriftDB provides replay through a primitive called **streams**. Clients can request to be sent the whole list of messages in a stream, starting from a given sequence number.

Streams are scoped to a particular room. A room may have multiple streams. Each message sent by a client includes a **key** (akin to a *subject* or *topic* in pub/sub) identifying the stream to send it to, and an **action** which determines how the stream is affected by the message. Streams are scoped to a room, and are created automatically the first time a message is sent to them.

When messages are relayed to clients, the key is included but the action is not.

The actions available in DriftDB are:

- The **`relay`** action does not modify the stream at all, only broadcasts the message.
- The **`replace`** action replaces the entire list with a single-element list containing the message’s payload, and broadcasts it.
- The **`append`** action appends the value to the list, and broadcasts it.
- The **`compact`** action takes a **sequence number**, and replaces every element in the list *up to and including* that sequence number with the provided value. It does broadcast the message.

These action primitives can be used to implement a number of message retention patterns:

- `relay` is similar to ephemeral **pub/sub**. The `key` can be used on the client to dispatch to interested subscribers.
- `replace` is similar to a key/value store, in which each write will overwrite the previous value.
- `append` is similar to an **append-only log** or durable stream.
- `compact` is similar to log compaction in a database.
