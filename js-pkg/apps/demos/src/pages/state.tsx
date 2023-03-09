import { DRIFTDB_URL } from '../config'
import Head from 'next/head'
import { Switch } from '@headlessui/react'
import { DriftDBProvider, RoomQRCode, StatusIndicator, useSharedState } from 'driftdb-react'

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

function StateDemo() {
  const [text, setText] = useSharedState("input", "Hello, World!")
  const [check, setCheck] = useSharedState("check", false)
  const [slider, setSlider] = useSharedState("slider", 50)

  return <div>
    <div className="flex flex-col gap-8 relative sm:max-w-md mb-8">
      <div className="flex flex-col gap-4">
        <Divider>Toggle</Divider>
        <Switch
          checked={check}
          onChange={setCheck}
          className={classNames(
            check ? 'bg-indigo-600' : 'bg-gray-200',
            'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2'
          )}
        >
          <span
            aria-hidden="true"
            className={classNames(
              check ? 'translate-x-5' : 'translate-x-0',
              'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
            )}
          />
        </Switch>
      </div>
      <div className="flex flex-col gap-4">
        <Divider>Text Input</Divider>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          className="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-md sm:leading-6"
          placeholder="type something here"
        />
      </div>
      <div className="flex flex-col gap-4">
        <Divider>Slider</Divider>
        <input
          type="range"
          className="w-full"
          min={1}
          max={1000}
          value={slider}
          onChange={e => setSlider(parseInt(e.target.value))}
        />
      </div>
    </div>
  </div>
}

export default function Demos() {
  return (
    <>
      <Head>
        <title>DriftDB Demos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div>
        <DriftDBProvider api={DRIFTDB_URL} crdt={true}>
          <h1 className="text-2xl font-bold text-gray-800 mb-6">DriftDB - Shared State Demo</h1>
          <StateDemo />
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

function Divider({ children }: { children: string }) {
  return <div className="relative">
    <div className="absolute inset-0 flex items-center" aria-hidden="true">
      <div className="w-full border-t border-gray-300" />
    </div>
    <div className="relative flex justify-start">
      <span className="bg-gray-100 pr-4 text-sm text-gray-500">{children}</span>
    </div>
  </div>
}
