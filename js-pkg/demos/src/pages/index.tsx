import Head from 'next/head'
import Link from 'next/link'

export default function Demos() {
  return (
    <>
      <Head>
        <title>DriftDB Demos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>
      <div>
        <h1>DriftDB Demos</h1>
        <ul>
          <li>Basic</li>
          <ul>
            <li><Link href="/state">Shared State</Link></li>
            <li><Link href="/counter">Counter</Link></li>
            <li><Link href="/tictactoe">Tic Tac Toe</Link></li>
          </ul>
          <li>Advanced</li>
          <ul>
            <li><Link href="/shared-canvas">Shared Canvas</Link></li>
            <li><Link href="/voxel">Voxel Editor</Link></li>
          </ul>
        </ul>
      </div>
    </>
  )
}
