import { DbConnection } from '.'
import { PresenceListener } from './presence'

type DataChannelMsg = { sender: string; value: any }
type OnMessage = (msg: DataChannelMsg) => void
type ChannelSendReceive = { send: (msg: string) => void; onMessage: OnMessage }
type ChannelCreator = (conn: RTCPeerConnection) => ChannelSendReceive

const getDataChannelCreator =
  (p1: string, p2: string, onMessage: OnMessage, throttleMs = 0) =>
  (conn: RTCPeerConnection) => {
    const dataChannel = conn.createDataChannel(p1)
    const sendRec = {
      send: (msg: string) => {
        console.log(msg)
      },
      onMessage
    }

    const dataChannelOnMessage = (e: MessageEvent<any>) =>
      sendRec.onMessage({ sender: p2, value: JSON.parse(e.data) })
    dataChannel.onmessage =
      throttleMs === 0 ? dataChannelOnMessage : throttle(dataChannelOnMessage, throttleMs)

    conn.ondatachannel = (e) => {
      if (e.channel.label === p2) {
        sendRec.send = e.channel.send.bind(e.channel)
      }
    }

    return sendRec
  }

function difference(setA: Set<any>, setB: Set<any>) {
  const _difference = new Set(setA)
  for (const elem of setB) {
    _difference.delete(elem)
  }
  return _difference
}

export class WebRTCConnections {
  private connMap = new Map<string, ChannelSendReceive>()
  private onMessage = (msg: DataChannelMsg) => {
    console.log('unhandled', msg)
  }

  constructor(private db: DbConnection, public myId: string, private throttle = 0) {}

  addNewConnection(p2: string) {
    const signalingChannel = new SignalingChannel(this.db, this.myId, p2)
    const conn = signalingChannel.createWebRTCConnection([
      getDataChannelCreator(this.myId, p2, (msg) => this.onMessage(msg), this.throttle)
    ])[0]
    this.connMap.set(p2, conn)
  }

  send(msg: string) {
    this.connMap.forEach((peer) => {
      peer.send(msg)
    })
  }

  setOnMessage(func: OnMessage) {
    this.onMessage = func
    this.connMap.forEach((peer) => {
      peer.onMessage = func
    })
  }

  removeConnection(peer: string) {
    this.connMap.delete(peer)
  }

  peers() {
    return this.connMap.keys()
  }
}

export class SyncedWebRTCConnections extends WebRTCConnections {
  presence: PresenceListener<string>
  constructor(db: DbConnection, id: string, throttle = 0) {
    super(db, id, throttle)
    this.presence = new PresenceListener<string>({
      initialState: '',
      db,
      clientId: id,
      callback: (msg) => {
        this.sync(Object.values(msg).map(({ value }) => value))
      },
      minPresenceInterval: throttle
    })
    this.refreshConnections()
    this.presence.subscribe()
  }

  refreshConnections() {
    let newId = (typeof crypto !== 'undefined' ? crypto.randomUUID() : 'PLACEHOLDER').slice(0, 5)
    this.myId = newId
    this.presence.updateState(newId)
  }

  sync(newPeers: string[]) {
    const curPeersSet = new Set(this.peers())
    const newPeersSet = new Set(newPeers)
    for (const elem of difference(curPeersSet, newPeersSet)) {
      this.removeConnection(elem)
    }

    for (const elem of difference(newPeersSet, curPeersSet)) {
      this.addNewConnection(elem)
    }
  }
}

class SignalingChannel {
  makingOffer = false
  conn: RTCPeerConnection | null = null
  polite: boolean

  constructor(private db: DbConnection, private p1: string, private p2: string) {
    this.polite = p1 < p2
    db.subscribe(p1 + p2, (msg) => {
      this.onMessage(msg.value as SignalingMessage)
    })
  }

  sendSignalingMessage(msg: SignalingMessage) {
    this.db.send({
      type: 'push', // send a message.
      action: { type: 'append' }, // append retains the message in the stream
      // see /data-model for actions
      value: msg, // any JSON-serializable value is allowed here
      key: this.p2 + this.p1
    })
  }

  createWebRTCConnection(connSetupArray: ChannelCreator[]): ChannelSendReceive[] {
    this.conn = createWebRTCConnection((makingOffer: boolean) => {
      this.makingOffer = makingOffer
    }, this.sendSignalingMessage.bind(this))
    const Connections = []
    for (let func of connSetupArray ?? []) {
      Connections.push(func(this.conn))
    }
    return Connections
  }

  async onMessage(msg: SignalingMessage) {
    if (!this.conn)
      throw new Error('Something went wrong. Connection not defined on SignalingChannel')
    const offerCollides = this.makingOffer || this.conn!.signalingState !== 'stable'
    const ignoreOffer = !this.polite && offerCollides
    console.log(msg)
    try {
      switch (msg.type) {
        case 'answer':
          await this.conn!.setRemoteDescription(msg)
          break
        case 'offer':
          if (ignoreOffer) break
          await this.conn!.setRemoteDescription(msg)
          await this.conn!.setLocalDescription()
          this.sendSignalingMessage({ type: 'answer', sdp: this.conn!.localDescription!.sdp })
          break
        case 'candidate':
          if (!msg.candidate) break
          try {
            await this.conn!.addIceCandidate(msg.candidate)
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

type SignalingMessage =
  | {
      type: 'offer'
      sdp: string
    }
  | {
      type: 'candidate'
      candidate: RTCIceCandidate | null
    }
  | {
      type: 'answer'
      sdp: string
    }

function createWebRTCConnection(
  setMakingOffer: (makingOffer: boolean) => void,
  sendSignalingMessage: (msg: SignalingMessage) => void
) {
  const conn = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  })

  conn.onnegotiationneeded = async () => {
    try {
      console.log('sending offer')
      setMakingOffer(true)
      await conn.setLocalDescription()
      // setLocalDescription makes sure localDescription is not null
      sendSignalingMessage({ type: 'offer', sdp: conn.localDescription!.sdp })
    } catch (e) {
      console.error(e)
    } finally {
      setMakingOffer(false)
    }
  }

  conn.onicecandidate = (e) => {
    let candidate = e.candidate
    sendSignalingMessage({ type: 'candidate', candidate })
  }

  conn.onconnectionstatechange = () => {
    console.log('current webrtc connection state: ', conn.connectionState)
  }

  conn.oniceconnectionstatechange = (_e) => {
    console.log(conn.iceConnectionState)
    if (conn.iceConnectionState === 'failed') {
      console.log('conn failed, restarting ICE')
      conn.restartIce()
    }
  }

  return conn
}

type AnyFunc = (...args: any[]) => void
function throttle(fn: AnyFunc, durationMs: number): AnyFunc {
  let block = false
  return (...args) => {
    if (!block) {
      fn(...args)
      block = true
      setTimeout(() => {
        block = false
      }, durationMs)
    }
  }
}
