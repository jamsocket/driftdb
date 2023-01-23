import { DRIFTDB_URL } from '@/config'
import Head from 'next/head'
import { DriftDBProvider, RoomQRCode, StatusIndicator, useSharedReducer } from 'driftdb-react'

type ActionType = 'increment' | 'decrement'

function CounterDemo() {
    const [state, dispatch] = useSharedReducer("counter", (state: number, action: ActionType) => {
        switch (action) {
            case 'increment':
                return state + 1
            case 'decrement':
                return state - 1
            default:
                return state
        }
    }, 0)

    return <div>
        <h1>DriftDB Shared Reducer Demo</h1>
        <h2>Counter value: {state}</h2>
        <button onClick={() => dispatch('increment')}>+</button>
        <button onClick={() => dispatch('decrement')}>-</button>
    </div>
}

export default function Counter() {
    return (
        <>
            <Head>
                <title>DriftDB Demos</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <div>
                <DriftDBProvider api={DRIFTDB_URL}>
                    <StatusIndicator />
                    <CounterDemo />
                    <RoomQRCode />
                </DriftDBProvider>
            </div>
        </>
    )
}
