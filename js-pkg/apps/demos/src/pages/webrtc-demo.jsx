import * as React from 'react'
import ReactDOM from "react-dom/client"
import { DriftDBProvider, usePresence} from 'driftdb-react'
import { Chat } from '../components/chat.jsx'
import { DRIFTDB_URL } from '../config'

const Peers = ({peers}) => {
    const listItems = peers.map(([sessionPeer, connPeer]) =>
	<li key={sessionPeer+connPeer}>
	    {sessionPeer} - {connPeer}
	</li>
    );
    return <ul> {listItems} </ul>
}
    

const Chats = ({ myId, peers }) => {
    const listChats = peers.map(([sessionPeer, connPeer]) => 
	    <li key={connPeer}>
		<h3> chat with {sessionPeer} </h3>
		<Chat myId={myId} withId={connPeer}/>
	    </li>
    );
    return (
	<ul>
	    {listChats}
	</ul>
    )
}

const useNewUniqueID = () => {
    let [id,_] = React.useState(typeof crypto !== "undefined" ? crypto.randomUUID() : "PLACEHOLDER")
    return id;
}

const RTCArea = () => {
    const clientId = useNewUniqueID();
    const others = usePresence("presence", clientId);
    const sessionPeerToConnPeer = Object.entries(others).map(([sessionId, { value }]) => [sessionId, value])
    return (
	<section>
	    <Peers peers={sessionPeerToConnPeer} /> 
	    <h1> chats </h1>
	    <Chats peers={sessionPeerToConnPeer} myId={clientId} />
	</section>
    ) 
}

const App = () => {
    return (
	<DriftDBProvider api={DRIFTDB_URL}>
	    <RTCArea/>
	</DriftDBProvider>
    )
}

export default App;
