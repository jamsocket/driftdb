import Head from 'next/head'

export default function Demos() {
  return (
    <>
      <Head>
        <title>DriftDB Demos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>
      <div className="mt-12 flex items-center justify-center text-lg text-gray-900">
        <h1>Select a demo in the sidebar</h1>
      </div>
    </>
  )
}
