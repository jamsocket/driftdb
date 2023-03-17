import { PresenceListener } from 'driftdb'
const dataChannelCreator = (p1, p2) => (conn) => {
    let dataChannel = conn.createDataChannel(p1)
    let theirdataChannel = (msg) => { console.log(msg) } 
    let onMessage = (msg) => { console.log(msg) }

    dataChannel.onmessage = (e) => {
	onMessage(e.data)
    }

    conn.ondatachannel = (e) => {
	if (e.channel.label === p2) {
	    theirdataChannel = e.channel
	}
    }

    return {
	send: (msg) => { theirdataChannel.send(msg) },
	onMessage
    }
}

function difference(setA, setB) {
    const _difference = new Set(setA);
    for (const elem of setB) {
	_difference.delete(elem);
    }
    return _difference;
}

class SyncMap extends Map {
    #indexSet = new Set()
    constructor(callback) {
	super()
	this.addCallback = callback
    }

    add(a) {
	this.#indexSet.add(a)
	this.set(a, this.addCallback(a))
    }

    delete(a) {
	this.#indexSet.delete(a)
	super.delete(a)
    }

    sync(as) {
	for (const elem of difference(this.#indexSet, as)) {
	    this.delete(elem)
	}

	for (const elem of difference(as, this.#indexSet)) {
	    this.add(elem)
	}
    }
}


export class WebRTCConnections extends SyncMap {
    constructor(db, myId) {
	super(WebRTCConnections.prototype.addCallback)
	this.myId = myId
	this.db = db
    }

    addNewConnection(p2) {
	const signalingChannel = createDriftDbSignalingChannel(this.db, this.myId, p2)
	const conn = createWebRTCConnection.call(
	    signalingChannel, [dataChannelCreator(this.myId, p2)]
	)[0]
	signalingChannel.onMessage = signalingHandler(this.myId < p2).bind(signalingChannel)
	return conn
    }

    send(msg) {
	this.forEach((peer) => {
	    peer.send(msg)
	})
    }

    set onMessage(func) {
	this.forEach((peer) => {
	    peer.onMessage = func
	})
    }
}

export function WebRTCBroadcastChannel(db, myId) {
    let webrtcconn = new WebRTCConnections(conn, uuid)
    let presenceSyncer =
	new PresenceListener({ initialState: null, db , clientId: myId, callback: (msg) => {
	let aim = Object.keys(msg)
	webrtcconn.sync(aim)
    }})
    presenceSyncer.subscribe()

    return webrtcconn
}
    


	
	

function signalingHandler(polite) {
    return async function(msg) {
	this.makingOffer = this.makingOffer ?? false
	this.offerCollides = this.makingOffer || this.conn.signalingState !== 'stable'
	const ignoreOffer = !polite && this.offerCollides
	console.log(msg)
	try {
	    switch (msg.type) {
	    case 'answer':
		await this.conn.setRemoteDescription(msg)
		break
	    case 'offer':
		if (ignoreOffer) break
		await this.conn.setRemoteDescription(msg)
		await this.conn.setLocalDescription()
		this.sendSignalingMessage({ type: 'answer', sdp: this.conn.localDescription.sdp })
		break
	    case 'candidate':
		try {
		    await this.conn.addIceCandidate(msg.candidate)
		} catch (err) {
		    if (!ignoreOffer) throw err
		}
		break
	    default:
		throw new Error('unknown message')
	    }
	} catch (e) {
	    console.error(e)
	    console.error('failed conn manip')
	}
    }
}

function createDriftDbSignalingChannel(db, p1, p2, onMessage = (msg) => {console.log(msg)}) {
    console.log(p1+p2)
    let signalingChannel = {onMessage,
			    sendSignalingMessage: (msg) => {
				db.send({
				    type: "push", // send a message.
				    action: {type: "append"}, // append retains the message in the stream
				    // see /data-model for actions
				    value: msg, // any JSON-serializable value is allowed here
				    key: p2+p1
				})
			    }
			   }
    db.subscribe(p1+p2, (msg) => { signalingChannel.onMessage(msg.value) })
    return signalingChannel
}


function createWebRTCConnection(connSetupArray) {
    this.conn = new RTCPeerConnection({
	iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    this.conn.onnegotiationneeded = async () => {
	try {
            console.log('sending offer')
            this.makingOffer = true
            await this.conn.setLocalDescription()
            this.sendSignalingMessage({ type: 'offer', sdp: this.conn.localDescription.sdp })
	} catch (e) {
            console.error(e)
	} finally {
            this.makingOffer = false
	}
    }

    this.conn.onicecandidate = (e) => {
	let candidate = e.candidate
	this.sendSignalingMessage({ type: 'candidate', candidate })
    }

    this.conn.onconnectionstatechange = () => {
	console.log('current webrtc connection state: ', this.conn.connectionState)
    }

    this.conn.oniceconnectionstatechange = (_e) => {
	console.log(this.conn.iceConnectionState)
	if (this.conn.iceConnectionState === 'failed') {
            console.log('conn failed, restarting ICE')
            this.conn.restartIce()
	}
    }


    const Connections = []
    console.log(connSetupArray)
    for (let func of connSetupArray ?? []) {
	Connections.push(func(this.conn))
    }

    return Connections 
}
