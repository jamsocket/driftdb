import { DRIFTDB_URL } from '@/config'
import Head from 'next/head'
import { DriftDBProvider, StatusIndicator, useSharedState } from '../components/driftdb-react'

function StateDemo() {
  const [text, setText] = useSharedState("input", "Hello, World!")
  const [check, setCheck] = useSharedState("check", false)
  const [slider, setSlider] = useSharedState("slider", 50)

  return <div>
    <h1>DriftDB Shared State Demo</h1>
    <div style={{display: 'flex', flexDirection: 'column'}}>
      <h2>Checkbox</h2>
      <label>
        <input type="checkbox" checked={check} onChange={e => setCheck(e.target.checked)} />
        Checkbox
      </label>
      <h2>Text Input</h2>
      <input value={text} onChange={e => setText(e.target.value)} />
      <h2>Slider</h2>
      <input type="range" min={1} max={1000} value={slider} onChange={e => setSlider(parseInt(e.target.value))} />
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
        <DriftDBProvider api={DRIFTDB_URL}>
          <StatusIndicator />
          <StateDemo />
        </DriftDBProvider>
      </div>
    </>
  )
}
