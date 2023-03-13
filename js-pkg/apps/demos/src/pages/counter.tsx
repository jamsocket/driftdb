import { DRIFTDB_URL } from '../config'
import Head from 'next/head'
import { MinusIcon, PlusIcon } from '@heroicons/react/20/solid'
import { DriftDBProvider, RoomQRCode, StatusIndicator, useSharedReducer } from 'driftdb-react'

type ActionType = 'increment' | 'decrement'

function CounterDemo() {
  const [state, dispatch] = useSharedReducer(
    'counter',
    (state: number, action: ActionType) => {
      switch (action) {
        case 'increment':
          return state + 1
        case 'decrement':
          return state - 1
        default:
          return state
      }
    },
    0
  )

  return (
    <div className="mt-4 mb-8">
      <h2 className="mb-2 text-md text-gray-800">Count: {state}</h2>
      <span className="isolate inline-flex rounded-md shadow-sm">
        <button
          type="button"
          onClick={() => dispatch('decrement')}
          className="relative inline-flex items-center rounded-l-md bg-white px-2 py-2 text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
        >
          <MinusIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => dispatch('increment')}
          className="relative -ml-px inline-flex items-center rounded-r-md bg-white px-2 py-2 text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-10"
        >
          <PlusIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </span>
    </div>
  )
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
          <h1 className="text-2xl font-bold text-gray-800">DriftDB - Shared Reducer Demo</h1>
          <CounterDemo />
          <div className="flex flex-col gap-4 sm:max-w-sm border border-gray-300 bg-gray-200 p-6 rounded-3xl">
            <StatusIndicator />
            <div className="overflow-hidden rounded-3xl">
              <RoomQRCode />
            </div>
          </div>
        </DriftDBProvider>
      </div>
    </>
  )
}
