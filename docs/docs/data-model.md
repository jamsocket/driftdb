# Data Model

The DriftDB client libraries (vanilla JS and [React](/docs/react)) provide abstractions for working with state, like presence, state machines, and key-value
storage. We anticipate that most users of DriftDB will use these abstractions, rather than interact with the APIs directly.

This document is for people who want to write their own abstractions, or just want to know what’s happening under the hood.

---

DriftDB exists to replicate program state across a network. The core idea of DriftDB is that if we can trustfully run arbitrary client-side
code, we can shift a lot of complexity from the server to the client. This means that the same simple server can power everything from shared whiteboards, to
casual games, to build-log streaming.

Specifically, **DriftDB is a keyed, ordered broadcast stream with replays and compaction.**

We’ll unpack that below, but first, a few words about the security model.

## Rooms

The words _trustfully run arbitrary client-side code_ may rightfully raise alarm. As a general rule, we can’t trust the
client to faithfully run the code we send it, because someone could maliciously spoof a client and connect it to our server.

DriftDB’s comprimise here is to silo the world into independent **rooms**, akin to rooms in a chat service. Rooms are identified by a random string which
doubles as a bearer token, so only people invited by someone in the room can connect to the room.

We designed DriftDB with this assumption because we observed that people building low-stakes multiplayer apps were already implicitly relying on this
assumption. But it does mean that if you want to build something that involves putting untrusted strangers in the same room, or has high-stakes outside of the
room (e.g. for-money online poker), DriftDB is not a good fit.

## Ordered Broadcast Channel

The atomic unit of data in DriftDB is a **message**. Messages can be any non-`null` JSON value. The contents of messages are opaque to DriftDB’s operations.

Every connection in DriftDB is scoped to a room. Messages sent over a connection are scoped to the same room as the connection.

Each room corresponds to an ordered stream of messages. Each client will receive every message sent in a room while they are connected, in the same order.
When the server rebroadcasts a message, it gives it a sequence number which represents its position in the room’s sequence. The first message in each room
is given the sequence number 1.

> (Why 1 and not 0? It’s common to need to store the sequence number of the “last message received”, and starting sequence numbers at 1 allows us to default that
to 0 before any messages have been received.)

## Keys

Every message in DriftDB is associated with a **key**, which is a string. Any string is allowed, including the empty string.

Keys can be used by an application to multiplex any number of “logical” streams on top of the global stream that DriftDB provides. Keys also matter to DriftDB
for the purpose of replays.

## Replays

When a client connects to a room, DriftDB immediately includes the client in every broadcast to that room, but does not automatically replay old messages to
the client.

Clients can request a replay of messages sent to a given key, optionally starting from a particular sequence number.

Internally, DriftDB stores messages in a hash map that associates each key with a growable ring buffer.

## Actions

Messages sent by clients are accompanied by an `action`, which determines whether they are added to the global broadcast stream, and whether they are replayable.

DriftDB implements four actions.

### `append`

The `append` action results in a message being broadcast, and added to the replayable stream for its key.

### `relay`

The `relay` action results in a message being broadcast, but not added to the replay stream for its key. `relay` messages are still treated as part of the ordered
broadcast and given a unique sequence number, but are discarded immediately by DriftDB immediately after they are broadcast.

### `replace`

The `replace` action broadcasts a message, and *replaces* the prior contents of the replay stream for just that message. You can think of `replace` as providing
key-value semantics, where only the last value set for a given key is retained.

### `compact`

Unlike the other actions, `compact` must be accompanied by a sequence number. Also unlike the other actions, the compact action
*does not* broadcast the message. Instead, it deletes all messages from the replay stream of the given key, up to and including the given sequence number.

`compact` then inserts the accompanying message at the *bacK* of the replay stream for the given key, with the sequence number provided.



