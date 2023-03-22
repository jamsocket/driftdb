import { PresenceListener } from './presence'
const dataChannelCreator =
  (p1, p2, onMessage, debounce = 10) =>
  (conn) => {
    let dataChannel = conn.createDataChannel(p1)
    let retObj = {
      send: (msg) => {
        console.log(msg)
      },
      onMessage
    }
    let active = true

    dataChannel.onmessage = (e) => {
      if (active) {
        retObj.onMessage({ sender: p2, value: JSON.parse(e.data) })
        active = false
        setTimeout(() => {
          active = true
        }, debounce)
      }
    }

    conn.ondatachannel = (e) => {
      if (e.channel.label === p2) {
        retObj.send = e.channel.send.bind(e.channel)
      }
    }

    return retObj
  }

function difference(setA, setB) {
  const _difference = new Set(setA)
  for (const elem of setB) {
    _difference.delete(elem)
  }
  return _difference
}

export class WebRTCConnections {
  #connMap = new Map()
  #onMessage = (msg) => {
    console.log('unhandled', msg)
  }
  constructor(db, myId) {
    this.myId = myId
    this.db = db
  }

  addNewConnection(p2) {
    const signalingChannel = createDriftDbSignalingChannel(this.db, this.myId, p2)
    const conn = createWebRTCConnection.call(signalingChannel, [
      dataChannelCreator(this.myId, p2, (msg) => this.#onMessage(msg))
    ])[0]
    signalingChannel.onMessage = signalingHandler(this.myId < p2).bind(signalingChannel)
    this.#connMap.set(p2, conn)
  }

  send(msg) {
    this.#connMap.forEach((peer) => {
      peer.send(msg)
    })
  }

  set onMessage(func) {
    this.#onMessage = func
    this.#connMap.forEach((peer) => {
      peer.onMessage = func
    })
  }

  removeConnection(peer) {
    this.#connMap.delete(peer)
  }

  get peers() {
    return new Set(this.#connMap.keys())
  }
}

export class syncedWebRTCConnections extends WebRTCConnections {
  #session_id
  constructor(db, id) {
    super(db, 'PLACEHOLDER')
    this.#session_id = id
    this.presence = new PresenceListener({
      initialState: null,
      db,
      clientId: this.#session_id,
      callback: (msg) => {
        this.sync(Object.values(msg).map(({ value }) => value))
      }
    })
    this.updateId()
    this.presence.subscribe()
  }

  updateId() {
    let newId = (typeof crypto !== 'undefined' ? crypto.randomUUID() : 'PLACEHOLDER').slice(0, 5)
    this.myId = newId
    this.presence.updateState(newId)
  }

  sync(as) {
    as = new Set(as)
    for (const elem of difference(this.peers, as)) {
      this.removeConnection(elem)
    }

    for (const elem of difference(as, this.peers)) {
      this.addNewConnection(elem)
    }
  }
}

function signalingHandler(polite) {
  return async function (msg) {
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
            console.log('DAFUQ', msg.candidate)
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

function createDriftDbSignalingChannel(
  db,
  p1,
  p2,
  onMessage = (msg) => {
    console.log(msg)
  }
) {
  let signalingChannel = {
    onMessage,
    sendSignalingMessage: (msg) => {
      db.send({
        type: 'push', // send a message.
        action: { type: 'append' }, // append retains the message in the stream
        // see /data-model for actions
        value: msg, // any JSON-serializable value is allowed here
        key: p2 + p1
      })
    }
  }
  db.subscribe(p1 + p2, (msg) => {
    signalingChannel.onMessage(msg.value)
  })
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
  for (let func of connSetupArray ?? []) {
    Connections.push(func(this.conn))
  }

  return Connections
}
