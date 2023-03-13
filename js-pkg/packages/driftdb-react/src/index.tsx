import {
  Api,
  ConnectionStatus,
  DbConnection,
  PresenceListener,
  Reducer,
  RoomResult,
  StateListener,
  uniqueClientId,
  WrappedPresenceMessage
} from 'driftdb'
import React, { SetStateAction, useCallback, useEffect, useRef, useState } from 'react'

const ROOM_ID_KEY = '_driftdb_room'

/**
 * A React component that provides a `DbConnection` to all child components.
 *
 * @param props The props for the component.
 */
export function DriftDBProvider(props: {
  /** Elements under the provider in the tree. */
  children: React.ReactNode
  /** The URL of the DriftDB API. */
  api: string
  /** The room ID to connect to. If not provided, attempts to extract the room ID
   *  from the URL and creates a new room if one is not present. */
  room?: string
  /** Whether to use binary messages (enables raw typed arrays in messages). */
  useBinary?: boolean
}): React.ReactElement {
  const dbRef = useRef<DbConnection | null>(null)
  if (dbRef.current === null) {
    dbRef.current = new DbConnection()
  }

  React.useEffect(() => {
    let api = new Api(props.api)

    let roomId
    if (props.room) {
      roomId = props.room
    } else {
      const searchParams = new URLSearchParams(window.location.search)
      roomId = searchParams.get(ROOM_ID_KEY)
    }

    let promise
    if (roomId) {
      promise = api.getRoom(roomId)
    } else {
      promise = api.newRoom()
    }

    promise.then((result: RoomResult) => {
      if (!props.room) {
        let url = new URL(window.location.href)
        url.searchParams.set(ROOM_ID_KEY, result.room)
        window.history.replaceState({}, '', url.toString())
      }

      dbRef.current?.connect(result.socket_url, props.useBinary)
    })

    return () => {
      dbRef.current?.disconnect()
    }
  }, [props.room, props.useBinary, props.api, dbRef.current])

  return <DatabaseContext.Provider value={dbRef.current}>{props.children}</DatabaseContext.Provider>
}

/**
 * A React context which is used to pass a database connection down the component tree
 * via the `DriftDBProvider` provider and `useDatabase` hook.
 */
export const DatabaseContext = React.createContext<DbConnection | null>(null)

/**
 * A React hook that returns a handle to the current database connection provided by the
 * nearest `DriftDBProvider` in the tree. If there is no `DriftDBProvider` in the tree,
 * throws an error.
 *
 * @returns A handle to the current database connection.
 */
export function useDatabase(): DbConnection {
  const db = React.useContext(DatabaseContext)
  if (db === null) {
    throw new Error('useDatabase must be used within a DriftDBProvider')
  }
  return db
}

type SetterFunction<T> = (value: T | ((v: T) => T)) => void

/**
 * A React hook that returns the current value of a shared state variable, and a function
 * to update it. The state variable is identified by a key, which must be unique within the
 * current room.
 *
 * @param key The key of the state variable.
 * @param initialValue The initial value of the state variable.
 *
 * @returns A tuple containing the current value of the state variable, and a function to
 * update it.
 */
export function useSharedState<T>(key: string, initialValue: T): [T, SetterFunction<T>] {
  const db = useDatabase()
  const [state, setInnerState] = React.useState<T>(initialValue)

  const stateListener = useRef<StateListener<SetStateAction<T>> | null>(null)

  if (stateListener.current === null) {
    stateListener.current = new StateListener(setInnerState, db, key)
  }

  useEffect(() => {
    stateListener.current!.subscribe()
  }, [stateListener.current])

  const setState = useCallback(
    (value: T | ((v: T) => T)) => {
      if (typeof value === 'function') {
        const currentValue = stateListener.current!.state ?? initialValue
        const newValue = (value as any)(currentValue)
        stateListener.current!.setStateOptimistic(newValue)
      } else {
        stateListener.current!.setStateOptimistic(value)
      }
    },
    [initialValue]
  )

  return [state, setState]
}

/**
 * A React hook which returns the current room ID, if any. The room ID is extracted from the
 * current URL, so it can be used outside of a `DriftDBProvider` tree.
 *
 * @returns The current room ID, or `null` if there is no room ID in the URL.
 */
export function useRoomIdFromUrl(): string | null {
  const [pageUrl, setPageUrl] = React.useState<string | null>(null)

  useEffect(() => {
    const callback = () => {
      if (typeof window === 'undefined') {
        return
      }

      const url = new URL(window.location.href)
      const checkRoom = url.searchParams.get(ROOM_ID_KEY)

      if (!checkRoom) {
        return
      }

      setPageUrl(window.location.href)
    }

    window.addEventListener('popstate', callback)
    window.addEventListener('pushstate', callback)
    window.addEventListener('replacestate', callback)
    window.addEventListener('hashchange', callback)
    callback()

    return () => {
      window.removeEventListener('popstate', callback)
      window.removeEventListener('pushstate', callback)
      window.removeEventListener('replacestate', callback)
      window.removeEventListener('hashchange', callback)
    }
  }, [])

  return pageUrl
}

/**
 * A React component that displays a QR code containing the current URL, including the room ID.
 * If there is no room ID in the URL, this component will not render anything.
 */
export function RoomQRCode(): React.ReactElement {
  const pageUrl = useRoomIdFromUrl()

  if (pageUrl) {
    return <img src={`https://api.jamsocket.live/qrcode?url=${pageUrl}`} />
  } else {
    return <></>
  }
}

/**
 * A React hook that returns a unique client ID for the current client. This ID is maintained
 * in the browser’s session storage, so it is retained across page reloads.
 *
 * @returns A unique client ID.
 */
export function useUniqueClientId(): string {
  const currentId = useRef<string>()

  if (typeof window === 'undefined') {
    return null!
  }

  if (!currentId.current) {
    currentId.current = uniqueClientId()
  }
  return currentId.current!
}

export function useSharedReducer<State, Action>(
  key: string,
  reducer: (state: State, action: Action) => State,
  initialValue: State
): [State, (action: Action) => void]

export function useSharedReducer<State, Action, InitialValue>(
  key: string,
  reducer: (state: State, action: Action) => State,
  initialValue: InitialValue,
  init: (initialValue: InitialValue) => State
): [State, (action: Action) => void]

/**
 * A React hook that returns a reducer state variable, and a function to update it. The state
 * variable is identified by a key, which must be unique within the current room.
 *
 * @param key The key that uniquely identifies the state variable within the current room.
 * @param reducer A reducer function that will be used to update the state variable.
 * @param initialValue The initial value of the state variable (if `init` is not passed),
 * or the value passed into `init` to produce the initial value.
 * @param init An optional function that will be used to produce the initial value of the
 * state variable.
 */
export function useSharedReducer<State, Action>(
  key: string,
  reducer: (state: State, action: Action) => State,
  initialValue: unknown,
  init: (v: any) => State = (a: any) => a
): [State, (action: Action) => void] {
  const db = useDatabase()

  const initialStateRef = useRef<State>(null!)
  if (initialStateRef.current === null) {
    initialStateRef.current = structuredClone(init(initialValue))
  }

  const [state, setState] = React.useState<State>(initialStateRef.current)

  const reducerRef = React.useRef<Reducer<State, Action> | null>(null)
  if (reducerRef.current === null) {
    reducerRef.current = new Reducer({
      key,
      reducer,
      initialValue: initialStateRef.current,
      sizeThreshold: 30,
      db,
      callback: setState
    })
  }

  useEffect(() => {
    reducerRef.current!.subscribe()
  }, [reducerRef.current])

  const dispatch = reducerRef.current.dispatch

  return [state, dispatch]
}

/**
 * A React hook that returns the current connection status of the database
 * from the current `DriftDBProvider`.
 * The result is an object with a `connected` property that is `true` if the
 * database is connected to the server. When `connected` is `true`, a `debugUrl`
 * property is also returned.
 *
 * @returns The current connection status of the database.
 */
export function useConnectionStatus(): ConnectionStatus {
  const db = useDatabase()
  const [status, setStatus] = React.useState<ConnectionStatus>({ connected: false })

  React.useEffect(() => {
    const callback = (event: ConnectionStatus) => {
      setStatus(event)
    }
    db?.statusListener.addListener(callback)
    return () => {
      db?.statusListener.removeListener(callback)
    }
  }, [db])

  return status
}

/**
 * A React hook that measures the latency of the database connection in a
 * loop and returns the current latency in milliseconds, or `null` before
 * the first measurement.
 */
export function useLatency(): number | null {
  const db = useDatabase()
  const [latency, setLatency] = useState<number | null>(null!)

  React.useEffect(() => {
    const updateLatency = async () => {
      const result = await db?.testLatency()
      setLatency(result)
    }

    const interval = setInterval(updateLatency, 5000)
    updateLatency()

    return () => {
      clearInterval(interval)
    }
  }, [db])

  return latency
}

/**
 * A React hook that returns a map of the current presence of all clients in the current room.
 * The client also passes its own value, which will be included in the map for other clients.
 *
 * @param key The key that uniquely identifies the presence variable within the current room.
 * @param value The value that will be included in the map for other clients.
 * @returns A map of the current presence of all clients in the current room.
 */
export function usePresence<T>(key: string, value: T): Record<string, WrappedPresenceMessage<T>> {
  const db = useDatabase()
  const clientId = useUniqueClientId()
  const [presence, setPresence] = useState<Record<string, WrappedPresenceMessage<T>>>({})

  const presenceListener = useRef<PresenceListener<T>>()
  if (presenceListener.current === undefined) {
    presenceListener.current = new PresenceListener({
      key,
      db,
      clientId,
      initialState: value,
      callback: setPresence
    })
  }

  useEffect(() => {
    presenceListener.current!.subscribe()
  }, [presenceListener.current])

  presenceListener.current.updateState(value)

  return presence
}

/**
 * A React component that displays the current connection status of the database.
 */
export function StatusIndicator(): React.ReactElement {
  const status = useConnectionStatus()
  const latency = useLatency()
  const latencyStr = latency === null ? '...' : Math.round(latency).toString()

  let color
  if (status.connected) {
    color = 'green'
  } else {
    color = 'red'
  }

  return (
    <div
      style={{
        display: 'inline-block',
        border: '1px solid #ccc',
        background: '#eee',
        borderRadius: 10,
        padding: 10
      }}
    >
      DriftDB status:{' '}
      <span style={{ color, fontWeight: 'bold' }}>
        {status.connected ? 'Connected' : 'Disconnected'}
      </span>
      {status.connected ? (
        <>
          {' '}
          <span style={{ fontSize: '70%', color: '#aaa' }}>
            <a
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none', color: '#aaa' }}
              href={status.debugUrl}
            >
              (ui)
            </a>
            ({latencyStr}ms)
          </span>
        </>
      ) : null}
    </div>
  )
}
