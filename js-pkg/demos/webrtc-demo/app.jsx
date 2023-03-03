import * as React from 'react'
import ReactDOM from "react-dom/client"
import { DriftDBProvider, useSharedReducer, useUniqueClientId } from 'driftdb-react'
import { Chat } from './chat.jsx'

const Peers = ({peers}) => {
    const listItems = peers.map(peer =>
	<li key={peer}>
	    {peer}
	</li>
    );
    return <ul> {listItems} </ul>
}
    

const Chats = ({ myId, peers }) => {
    const listChats = peers.map(peer => {
	return (
	    <li key={peer}>
		<h3> chat with {peer} </h3>
		<Chat myId={myId} withId={peer}/>
	    </li>
	)
    });
    return (
	<ul>
	    {listChats}
	</ul>
    )
}


const RTCArea = () => {
    const clientId = useUniqueClientId()
    const [peers, peerDispatch] = useSharedReducer("peers", (state, action) => {
	console.log(state)
	let setforstate = new Set(state)
	switch(action.type) {
	case "add":
	    setforstate.add(action.id)
	    break
	    //return state
	case "remove":
	    setforstate.delete(action.id)
	    break
	}
	return [...setforstate]
    }, [])

    React.useEffect(() => {
	peerDispatch({ type: "add", id: clientId })
	return () => {
	    peerDispatch({ type: "remove", id: clientId })
	}
    }, [])

    let otherPeers = peers.filter((peer) => peer !== clientId)

    return (
	<section>
	    <Peers peers={peers} />
	    <h1> chats </h1>
	    <Chats peers={otherPeers} myId={clientId} />
	</section>
    ) 
}

const App = () => {
    return (
	<DriftDBProvider api="https://api.jamsocket.live/db/WLDweFEUscLaUO7siNKf/">
	    <RTCArea/>
	</DriftDBProvider>
    )
}

const container = document.getElementById('root');

const root = ReactDOM.createRoot(container)

root.render(<App/>)
