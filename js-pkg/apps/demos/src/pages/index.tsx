import Head from 'next/head'
import Link from 'next/link'

const demos = [
  {
    title: 'Shared State',
    href: '/state',
    description: 'A simple demo that shows how useSharedState works with some form elements.'
  },
  {
    title: 'Shared Reducer',
    href: '/counter',
    description:
      'Let multiple clients increment and decrement a shared counter with useSharedReducer.'
  },
  {
    title: 'Tic Tac Toe',
    href: '/tictactoe',
    description: 'The classic Tic Tac Toe game, implemented with DriftDB.'
  },
  {
    title: 'Shared Canvas',
    href: '/shared-canvas',
    description: 'Multiple users draw on a shared canvas.'
  },
  {
    title: 'Voxel Editor',
    href: '/voxel',
    description: 'Edit voxels in a shared environment.'
  },
  {
    title: 'WebRTC Chat',
    href: '/webrtc',
    description: 'Simple chat with WebRTC datachannels, using DriftDB for signaling.'
  },
  {
    title: 'WebRTC Cursors',
    href: '/webrtc-cursors',
    description:
      'Multiple cursors on a canvas implemented using both WebRTC and edge hosted WebSockets.'
  }
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function Demos() {
  return (
    <>
      <Head>
        <title>DriftDB Demos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>
      <div className="max-w-3xl p-8 mx-auto flex flex-col items-center justify-center text-lg text-gray-900">
        <h1 className="my-8 text-4xl font-extrabold text-gray-700 w-full ">DriftDB Demos</h1>
        <div className="divide-y divide-gray-200 overflow-hidden rounded-lg bg-gray-200 shadow sm:grid sm:grid-cols-2 sm:gap-px sm:divide-y-0">
          {demos.map((demo, demoIdx) => (
            <div
              key={demo.title}
              className={classNames(
                demoIdx === 0 ? 'rounded-tl-lg rounded-tr-lg sm:rounded-tr-none' : '',
                demoIdx === 1 ? 'sm:rounded-tr-lg' : '',
                demoIdx === demos.length - 2 ? 'sm:rounded-bl-lg' : '',
                demoIdx === demos.length - 1
                  ? 'rounded-bl-lg rounded-br-lg sm:rounded-bl-none'
                  : '',
                'group relative bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500'
              )}
            >
              <div className="mt-2">
                <h3 className="text-base font-semibold leading-6 text-gray-900">
                  <Link href={demo.href} className="focus:outline-none">
                    {/* Extend touch target to entire panel */}
                    <span className="absolute inset-0" aria-hidden="true" />
                    {demo.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-gray-500">{demo.description}</p>
              </div>
              <span
                className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                aria-hidden="true"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                </svg>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
