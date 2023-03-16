import * as React from 'react'
import { DriftDBProvider, usePresence, useLatency } from 'driftdb-react'
import { Chat } from '../components/chat.jsx'
import { DRIFTDB_URL } from '../config'

const Chats = ({ myId, peers, myLatency }) => {
  return (
    <ul className="flex flex-wrap gap-2">
      {peers.map(([sessionPeer, val]) => (
        <Chat
          key={val.id}
          myId={myId}
          withId={val.id}
          driftDBLatency={val.latency + myLatency}
          sessionPeer={sessionPeer}
        />
      ))}
    </ul>
  )
}

const useNewUniqueID = () => {
  let [id, _] = React.useState(typeof crypto !== 'undefined' ? crypto.randomUUID() : 'PLACEHOLDER')
  return id.slice(0, 5)
}

const sessionPeerToValue = (obj) =>
  Object.entries(obj).map(([sessionId, { value }]) => [sessionId.slice(0, 5), value])

const RTCArea = () => {
  const clientId = useNewUniqueID()
  const myLatency = useLatency()
  const others = usePresence('presence', { id: clientId, latency: myLatency })
  const peers = sessionPeerToValue(others)

  return (
    <section>
      <h1 className="text-4xl font-extrabold tracking-tight my-5">WebRTC Chat Demo</h1>
      {peers.length === 0 ? <div className="">Share this URL to start a chat!</div> : null}
      <Chats peers={peers} myId={clientId} myLatency={myLatency} />
    </section>
  )
}

const App = () => {
  return (
    <DriftDBProvider api={DRIFTDB_URL}>
      <RTCArea />
    </DriftDBProvider>
  )
}

export default App
