import * as React from 'react'
import { useDriftDBSignalingChannel } from './driftdbutils';


export const useWebRTCMessagingChannel = (p1, p2) => {
    let [isInited, isReady, connRef, connID] = useWebRTCConnection(p1,p2)
    let [theyAreReady, setTheyAreReady] = React.useState(false)
    let [messages, addMessage] = React.useReducer((state, msg) => [...state, msg], [])
    let mydataChannelRef = React.useRef(null)
    let theirdataChannelRef = React.useRef(null)
    React.useEffect(() => {
	if(isInited) {
	    let dataChannel = connRef.current.createDataChannel(p1)
	    dataChannel.onopen = () => {
		console.log("DC OPEN!!!")
	    }

	    dataChannel.onmessage = e => {
		addMessage({id: e.timeStamp, text: e.data})
	    }


	    dataChannel.onerror = e => {
		console.error(e)
	    }


	    connRef.current.ondatachannel = (e) => {
		console.log("ondc fires")
		if(e.channel.label === p2) {
		    setTheyAreReady(true)
		    theirdataChannelRef.current = e.channel
		}
	    }
		    
	    mydataChannelRef.current = dataChannel
	}
	return () => {
	    setTheyAreReady(false)
	    if(isReady) {
		mydataChannelRef.current.close()
	    }
	}
    }, [connID, isInited])

    return [ messages, theyAreReady ? theirdataChannelRef.current.send.bind(theirdataChannelRef.current) : (msg) => {console.log("unsent: ", msg)} ]
}

export const useWebRTCConnection = (p1, p2) => {
    let [signalingMessages, setSignalingMessages, removeFromRecv, emptySend]= useDriftDBSignalingChannel(p1, p2)
    const [connID, setconnID] = React.useState(0)
    const incrementConnID = ()=>setconnID((connID) => connID + 1)
    const [isReady, setIsReady] = React.useState(false)
    const reachedStableRef = React.useRef(false)
    const [isInited, setIsInited] = React.useState(false)
    const isPeerPolite = p1 < p2;
    let connRef = React.useRef(null)
    let makingOfferRef = React.useRef(false)
    React.useEffect(() => {
	let conn = new RTCPeerConnection({
	    iceServers: [
		{urls: "stun:stun.l.google.com:19302"}
	    ]}) 

	connRef.current = conn
	setIsInited(true)

	conn.addEventListener("negotiationneeded", async () => { 
		    try {
			makingOfferRef.current = true
			await conn.setLocalDescription()
			setSignalingMessages({ type: "offer", sdp: conn.localDescription.sdp })
		    } catch(e) { console.error(e) } finally {
			makingOfferRef.current = false 
		    }
	})

	conn.onicecandidate = (e) => {
	    let candidate = e.candidate
	    setSignalingMessages({ type: "candidate", candidate })
	}
	/*
	conn.onconnectionstatechange = () => {
	    console.log("conn state changed")
	    console.log(conn.connectionState)
	    if(conn.connectionState === "connected") {
		console.log("hello")
			    } else {
		setIsReady(false)
	    }
	}
	*/

	conn.oniceconnectionstatechange = () => {
	    console.log(conn.iceConnectionState)
	    if(conn.iceConnectionState === "completed" || conn.iceConnectionState === "connected") {
		console.log('icecomplete')
		setIsReady(true)
		reachedStableRef.current = true 
	    }

	    if(conn.iceConnectionState === "failed" || conn.iceConnectionState === "disconnected") {
		console.log("conn failed, restarting ICE")
		conn.restartIce()
	    }
	}

	conn.onsignalingstatechange = () => {
	    console.log(conn.signalingState)
	    if (reachedStableRef.current && conn.signalingState !== "stable") {
		console.log("huh?")
		incrementConnID()
	    }
	}
		


	return () => {
	    console.log("destroying conn")
	    emptySend()
	    conn.close()
	    setIsInited(false)
	    setIsReady(false)
	    makingOfferRef.current=false
	    reachedStableRef.current = false 
	}
    }, [connID])

    React.useEffect(() => {
	(async () => {
	let conn = connRef.current
	let makingOffer = makingOfferRef.current
	const offerCollides = makingOffer || conn.signalingState !== "stable"
	const ignoreOffer = !isPeerPolite && offerCollides
	let processed = 0
	try {
	    console.log("message under consideration")
	    console.log(signalingMessages)
	    for (let msg of signalingMessages) {
		console.log(msg)
		processed++
		switch (msg.type) {
		case "answer":
		    await conn.setRemoteDescription(msg)
		    break
		case "offer":
		    console.log(ignoreOffer)
		    console.log(conn.signalingState)
		    console.log(reachedStableRef.current)
		    if(reachedStableRef.current && conn.signalingState !== 'stable') {
			console.error("known unhandled race condition, refresh other side")
		    }
		    if(ignoreOffer) break
		    await conn.setRemoteDescription(msg)
		    await conn.setLocalDescription()
		    setSignalingMessages({ type: "answer", sdp: conn.localDescription.sdp })
		    break
		case "candidate":
		    try {
			await conn.addIceCandidate(msg.candidate)
		    } catch (err) {
			if (!ignoreOffer) throw err
		    }
		    break
		default:
		    throw("unknown message")
		}
	    }
	    } catch (e) {
		    console.error(e)
		    console.error("failed conn manip")

	    } finally {
		if(processed > 0) removeFromRecv(processed) 
	    }

	})()
    }, [signalingMessages])

    return [isInited, isReady, connRef, connID]
}
