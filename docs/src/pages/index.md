# DriftDB

**DriftDB is a real-time database for browser-based applications**. You can think of it as a key-value store that speaks WebSocket, with a few other tricks up its sleeve.

DriftDB is MIT-licensed Rust code. A client library is provided for JavaScript, as well as a helper library for React applications. We also provide hosted DriftDB instances called <a href="https://jamsocket.live">Jamsocket Live</a>. These docs are applicable both to self-hosted and Jamsocket Live instances.

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

`DriftDBProvider` looks in the page’s URL for an existing DriftDB room ID. If it finds one, it joins it. If it doesn’t, it creates a new room, and updates the URL to include it. This way, your user can share the URL with a friend, and when they open it, they’ll instantly be sharing state.

For more details on DriftDB-React, see [the React docs](/docs/react).

## Limitations

DriftDB is intended for use cases where a relatively small number of clients need to share some state over a relatively short period of time. For example, it could be used to build a shared whiteboard, or act as a signaling server for WebRTC. It does not currently support persisted state.

DriftDB has a very basic trust model: if you have the room ID, you have write access to all data in the room. This is useful for applications whose multiplayer functionality can be siloed into rooms, where access to each room can be limited to a set of people trusted by the room’s creator.

If you want to run arbitrary server-side code for persistence or access control, consider using [Plane](https://plane.dev/) instead.

## Learn more

- [Read more about the React interface](/docs/react)
- [Learn about the underlying data model](/docs/data-model)
- [Learn the API](/docs/api)
