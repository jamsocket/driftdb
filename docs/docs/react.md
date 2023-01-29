---
sidebar_position: 1
---

# React Interface

## Installation

Install `DriftDB-React` using `npm`:

    npm i driftdb-react

To get started with DriftDB-React, you will need the URL of a running DriftDB server. Either follow the instructions (TODO) to run a server of your own, or sign up at [Jamsocket.live](https://jamsocket.live) for a free hosted instance.

## Connecting

DriftDB-React makes use of two react patterns: a **provider** to connect to the database, and **hooks** to access it. DriftDB-React exports the `DriftDBProvider` component, which instantiates a database connection.

Components must be enclosed in a `DriftDBProvider` component to use the hooks that DriftDB-React provides (this approach ensures that all hooks share the underlying connection). You should not use multiple `DriftDBProvider` instances on the same page; instead, put a single `DriftDBProvider` component high enough up in the document tree that all components which need to use the database are children of it.

The provider takes a required parameter `database`, which must be the URL of a running DriftDB server. This can either be one that you run on your own, or one provided by [Jamsocket Live](https://jamsocket.live).

```jsx
<DriftDBProvider api="https://jamsocket.live/db/[YOUR_KEY]">
    {
        // Components in here (and their descendants)
        // can use DriftDB-React hooks.
    }
</DriftDBProvider>
```

## `useConnectionStatus` hook

The `useConnectionStatus` hook returns an object with the current connection status of the database. If the status is *connected*, it also returns a link to a debug UI for the room.

The `StatusIndicator` component uses this hook to display the current connection status, including a link to inspect the database in the DriftDB debug UI. This is meant for development; in a real application, you could replace this with a custom component that suits your UI using the output of `useConnectionStatus`.

## `useSharedState` hook

DriftDB-React provides a hook called `useSharedState`, which is similar to the [`useState`](https://reactjs.org/docs/hooks-state.html) hook provided by React, except that it synchronizes state across all clients connected to the same room.

In order to do this, `useSharedState` adds an additional parameter, which is a key in the associated DriftDB room.

Here’s an example of using `useSharedState` to create a checkbox that is synchronized across all clients in the same room:

```jsx
function MyComponent() {
    const [value, setValue] = useSharedState("my-checkbox", false);

    return <input
        type="checkbox"
        checked={value}
        onChange={e => setValue(e.target.checked)}
    />;
}
```

`useSharedState` is debounced on the client side, meaning that if you make calls to it in rapid succession, it will wait for a short period and send only the last value to the server. `useSharedState` is optimistic, so calls to `setValue` will be reflected locally before they are confirmed by the server.

## `useSharedReducer` hook

There are two major limitations to `useSharedState`:
- The entire state is sent on every update. This is fine for small values, but does not scale well to more complex state.
- It overwrites the entire state on every update. If two clients try to update the state at the same time, one of them will be overwritten.

To address these limitations, DriftDB-React provides a hook called `useSharedReducer`, which is a shared version of React’s [`useReducer`](https://reactjs.org/docs/hooks-reference.html#usereducer) hook. Like `useSharedState`, `useSharedReducer` adds an additional `key` parameter as the first argument.

Here’s an example of using `useSharedReducer` to implement a counter that is synchronized across all clients in the same room:

```jsx
function CounterComponent() {
    const [count, dispatch] = useSharedReducer("my-counter", (state, action) => {
        switch (action.type) {
            case "increment":
                return state + 1;
            case "decrement":
                return state - 1;
            default:
                return state;
        }
    }, 0);

    return (
        <div>
            <button onClick={() => dispatch({ type: "decrement" })}>-</button>
            <span>{count}</span>
            <button onClick={() => dispatch({ type: "increment" })}>+</button>
        </div>
    );
}
```

Like `useSharedState`, `useSharedReducer` is optimistic, so calls to `dispatch` will be reflected locally before they are confirmed by the server. `useSharedReducer` guarantees that the same change will be applied in the same order across all clients. To make this work, it may need to rewind a local optimistic change to reapply it in the correct order.

`useSharedReducer` is possible because DriftDB allows keys to have a sequence of values, instead of just one. Changes are appended to the end of the sequence, instead of replacing the previous value as `useSharedState` does. When a new client joins, it plays back the entire sequence of changes to bring it up to date.

To avoid the sequence from growing indefinitely, `useSharedReducer` uses **cooperative compaction**. Clients coordinate with the database so that when the sequence for a given key grows too long, the client will replace it with a snapshot of the state at a more recent version, and instructs the server to discard all changes prior to that version.

## `useDatabase` hook

The `useDatabase` hook returns an instance of the DriftDB database itself. This is useful if you want to access the database on a lower level than is exposed through the other hooks.

## `useUniqueClientId` hook

The `useUniqueClientId` hook returns a short string which can be used to uniquely identify the current client. This string is stored in session storage, so that it will persist across page reloads.

`useUniqueClientId` is provided as a helper, but does not interact with the DriftDB database.

## `<RoomQRCode />` component

The `RoomQRCode` component displays a QR code encoding the URL of the current page, if it contains the ID of a DriftDB room. This provides an easy way to connect to rooms from a phone.
