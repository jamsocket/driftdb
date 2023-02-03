# DriftDB

[![GitHub Repo stars](https://img.shields.io/github/stars/drifting-in-space/driftdb?style=social)](https://github.com/drifting-in-space/driftdb)
[![crates.io](https://img.shields.io/crates/v/driftdb.svg)](https://crates.io/crates/driftdb)
[![docs.rs](https://img.shields.io/badge/rust-docs-brightgreen)](https://docs.rs/driftdb/)
[![docs.rs](https://img.shields.io/badge/client-docs-brightgreen)](https://driftdb.com/)
[![Test](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml/badge.svg)](https://github.com/drifting-in-space/driftdb/actions/workflows/test.yml)
[![Chat on Discord](https://img.shields.io/static/v1?label=chat&message=discord&color=404eed)](https://discord.gg/N5sEpsuhh9)

**DriftDB is a real-time data backend that runs on the edge.** Clients connect to it directly over a WebSocket. It supports a number of messaging primitives, including:

- Publisher / subscriber channels (PubSub)
- Key/value storage with subscriptions
- Ordered streams

As an example of what it’s capable of, here’s a [multiplayer voxel editor](https://demos.driftdb.com/voxel) in [under 200 lines of code](https://github.com/drifting-in-space/driftdb/blob/main/js-pkg/demos/src/pages/voxel.tsx).

<div style={{display: "flex", flexDirection: "row", justifyContent: "center", margin: 25}}>
<video controls autoplay style={{maxWidth: "100%"}}>
  <source src="/driftdb-voxel.webm" type="video/webm" />
  <source src="/driftdb-voxel.mp4" type="video/mp4" />
</video>
</div>

DriftDB is MIT-licensed Rust code. A client library is provided for JavaScript, as well as ergonomic React bindings.

We also provide hosted DriftDB instances called <a href="https://jamsocket.live">Jamsocket Live</a>. These docs are applicable both to self-hosted and Jamsocket Live instances.

## Live Demos

- [Shared State](https://demos.driftdb.com/state) ([code](https://github.com/drifting-in-space/driftdb/blob/main/js-pkg/demos/src/pages/shared-canvas.tsx))
- [Counter](https://demos.driftdb.com/counter) ([code](https://github.com/drifting-in-space/driftdb/blob/main/js-pkg/demos/src/pages/counter.tsx))
- [Tic Tac Toe](https://demos.driftdb.com/tictactoe) ([code](https://github.com/drifting-in-space/driftdb/blob/main/js-pkg/demos/src/pages/tictactoe.tsx))
- [Voxel Editor](https://demos.driftdb.com/voxel) ([code](https://github.com/drifting-in-space/driftdb/blob/main/js-pkg/demos/src/pages/voxel.tsx))

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

All messages in DriftDB belong to a **room**, and have a **subject**. Rooms and subjects are both represented by strings. Rooms are represented by a unique generated string of characters. Subjects are chosen by the developer and usually have a meaning in the context of the application. In the example above, `slider` is the name of the subject used for synchronizing the state of the range slider input.

The room in the example above depends on whether the user visits the page directly or via a link that includes a room ID. If the user visits the page directly, a new room ID is generated and inserted into the URL. If another user opens the same URL, they will be connected to the same room, and instantly be sharing state. This is not behavior of DriftDB itself, but of the `DriftDBProvider` React component used as a client.

A connection with the server is scoped to a **room**. Messages to multiple subjects (within the same room) are multiplexed over one connection.

For more details on DriftDB-React, see [the React docs](/docs/react) or [this four-minute tutorial video](https://www.youtube.com/watch?v=ktb6HUZlyJs).

## Limitations

DriftDB is intended for use cases where a relatively small number of clients need to share some state over a relatively short period of time. For example, it could be used to build a shared whiteboard, or act as a signaling server for WebRTC. It does not currently support persisted state.

DriftDB has a very basic trust model: if you have the room ID, you have write access to all data in the room. This is useful for applications whose multiplayer functionality can be siloed into rooms, where access to each room can be limited to a set of people trusted by the room’s creator.

If you want to run arbitrary server-side code for persistence or access control, consider using [Plane](https://plane.dev/) instead.

## Learn more

- [Read more about the React interface](/docs/react)
- [Learn the API](/docs/api)
