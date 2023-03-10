import * as React from 'react'
import { DriftDBProvider, usePresence } from 'driftdb-react'
import { Chat } from '../components/chat.jsx'
import { DRIFTDB_URL } from '../config'

const Peers = ({ peers }) => {
    const listItems = peers.map(([sessionPeer, connPeer]) => (
	<tr> <td className="border px-4 mx-3" > {sessionPeer} </td>
	<td className="border px-4 mx-3"> {connPeer} </td> </tr>
    ))
    return (
	<table className="border p-4 m-5" >
	    <thead className="border">
		<tr> <th colspan="2" className="border"> PeerTable </th> </tr>
		<tr> <th className="border mx-3"> Session ID </th> <th> Connection ID </th> </tr>
	    </thead>
	    <tbody>
		{listItems}
	    </tbody>
	</table>
    )
}

const Chats = ({ myId, peers }) => {
  const listChats = peers.map(([sessionPeer, connPeer]) => (
    <li key={connPeer}>
      <h3 className="underline"> Chat with {sessionPeer} </h3>
      <Chat myId={myId} withId={connPeer} />
    </li>
  ))
  return <ul>{listChats}</ul>
}

const useNewUniqueID = () => {
  let [id, _] = React.useState(typeof crypto !== 'undefined' ? crypto.randomUUID() : 'PLACEHOLDER')
  return id
}

const RTCArea = () => {
  const clientId = useNewUniqueID()
  const others = usePresence('presence', clientId)
  const sessionPeerToConnPeer = Object.entries(others).map(([sessionId, { value }]) => [
    sessionId,
    value
  ])
  return (
    <section>
      <Peers peers={sessionPeerToConnPeer} />
      <h1 className="text-4xl text-center m-5"> Chats </h1>
      <Chats peers={sessionPeerToConnPeer} myId={clientId} />
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
