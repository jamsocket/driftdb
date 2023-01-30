# DriftDB

[![GitHub Repo stars](https://img.shields.io/github/stars/drifting-in-space/driftdb?style=social)](https://github.com/drifting-in-space/driftdb)
[![crates.io](https://img.shields.io/crates/v/driftdb.svg)](https://crates.io/crates/driftdb)
[![docs.rs](https://img.shields.io/badge/rust-docs-brightgreen)](https://docs.rs/driftdb/)
[![docs.rs](https://img.shields.io/badge/client-docs-brightgreen)](https://driftdb.com/)
[![Test](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml/badge.svg)](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml)

**DriftDB is a real-time data backend that runs on the edge.** Clients connect to it directly over a WebSocket. It supports a number of messaging primitives, including:

- Publisher / subscriber channels (PubSub)
- Key/value storage with subscriptions
- Ordered streams

DriftDB is MIT-licensed Rust code. A client library is provided for JavaScript, as well as ergonomic React bindings.

We also provide hosted DriftDB instances called <a href="https://jamsocket.live">Jamsocket Live</a>. These docs are applicable both to self-hosted and Jamsocket Live instances.

<div style={{display: "flex", flexDirection: "row", justifyContent: "center", marginBottom: 30}}>
    <iframe width="560" height="315" src="https://www.youtube.com/embed/ktb6HUZlyJs" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
</div>

## Live Demos

- [Shared State](https://demos.driftdb.com/state)
- [Counter](https://demos.driftdb.com/counter)
- [Tic Tac Toe](https://demos.driftdb.com/tictactoe)

## React example

Here’s an example of DriftDB-React in action to synchronize a slider element across multiple clients:

```jsx
import { DriftDBProvider, useSharedState } from 'driftdb-react'

function StateDemo() {
    // useSharedState is like useState, but synchronized with other clients.
    const [slider, setSlider] = useSharedState("slider", 0)

    return <div>
        <input
            type="range"
            value={slider}
            onChange={e => setSlider(parseInt(e.target.value))}
        />
    </div>
}

export default function SliderDemo() {
    /*  TODO: fill with a key from jamsocket.live,
        or your own hosted DriftDB instance. */
    const dbUrl = "https://api.jamsocket.live/db/FILL_ME_IN"
    return <div>
        <DriftDBProvider api={dbUrl}>
            <StateDemo />
        </DriftDBProvider>
    </div>
}
```

All messages in DriftDB belong to a **room**, and have a **subject**. Rooms and subjects are both represented by strings. Rooms are represented by a unique generated string of characters. Subjects are chosen by he developer and usually have a meaning in the context of the application. In the example above, `slider` is the name of the subject used for synchronziing the state of the range slider input.

The room in the example above depends on whether the user visits the page directly or via a link that includes a room ID. If the user visits the page directly, a new room ID is generated and inserted into the URL. If another user opens the same URL, they will be connected to the same room, and instantly be sharing state. This is not behavior of DriftDB itself, but of the `DriftDBProvider` React component used as a client.

A connection with the server is scoped to a **room**. Messages to multiple subjects (within the same room) are multiplexed over one connection.

For more details on DriftDB-React, see [the React docs](/docs/react).

## Limitations

DriftDB is intended for use cases where a relatively small number of clients need to share some state over a relatively short period of time. For example, it could be used to build a shared whiteboard, or act as a signaling server for WebRTC. It does not currently support persisted state.

DriftDB has a very basic trust model: if you have the room ID, you have write access to all data in the room. This is useful for applications whose multiplayer functionality can be siloed into rooms, where access to each room can be limited to a set of people trusted by the room’s creator.

If you want to run arbitrary server-side code for persistence or access control, consider using [Plane](https://plane.dev/) instead.

## Learn more

- [Read more about the React interface](/docs/react)
- [Learn the API](/docs/api)
