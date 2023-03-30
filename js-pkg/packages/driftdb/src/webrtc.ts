import { DbConnection } from '.'
import { PresenceListener, WrappedPresenceMessage } from './presence'

export type DataChannelMsg = { sender: string; value: any; lastSeen: number }
type OnMessage = (msg: DataChannelMsg) => void
type ChannelSendReceive = { send: (msg: string) => void; onMessage: OnMessage }
type ChannelCreator = (conn: RTCPeerConnection) => ChannelSendReceive

const getDataChannelCreator =
  (p1: string, p2: string, onMessage: OnMessage) => (conn: RTCPeerConnection) => {
    const dataChannel = conn.createDataChannel(p1)
    const sendRec: ChannelSendReceive = {
      send: (msg: string) => {
        console.log(msg)
      },
      onMessage
    }

    const dataChannelOnMessage = (e: MessageEvent<any>) => {
      const msg = { sender: p2, value: JSON.parse(e.data), lastSeen: e.timeStamp }
      sendRec.onMessage(msg)
    }
    dataChannel.onmessage = dataChannelOnMessage

    conn.ondatachannel = (e) => {
      if (e.channel.label === p2) {
        sendRec.send = e.channel.send.bind(e.channel)
      }
    }

    return sendRec
  }

export class WebRTCConnections {
  public connMap = new Map<string, ChannelSendReceive>()
  private onMessage = (msg: DataChannelMsg) => {
    console.log('unhandled', msg)
  }
  private onFailure = (conn: RTCPeerConnection) => {
    conn.restartIce()
  }

  constructor(private db: DbConnection, public myId: string, private throttleMs = 0) {}

  addNewConnection(p2: string) {
    const signalingChannel = new SignalingChannel(this.db, this.myId, p2)
    const conn = signalingChannel.createWebRTCConnection(
      [getDataChannelCreator(this.myId, p2, (msg) => this.onMessage(msg))],
      this.onFailure
    )[0]
    return conn
  }

  getConn(peer: string) {
    return this.connMap.get(this.myId + peer)
  }

  setConnMap(entries: [string, ChannelSendReceive][]) {
    this.connMap = new Map(entries.map(([peer, conn]) => [this.myId + peer, conn]))
  }

  send = throttle((msg: string) => {
    this.connMap.forEach((peer) => {
      peer.send(msg)
    })
  }, this.throttleMs)

  setOnMessage(func: OnMessage) {
    this.onMessage = func
    this.connMap.forEach((peer) => {
      peer.onMessage = func
    })
  }

  setOnFailure(func: (conn: RTCPeerConnection) => void) {
    this.onFailure = func
  }
}

export class SyncedWebRTCConnections extends WebRTCConnections {
  presence: PresenceListener<string>
  private peersToLastMsg: Record<string, WrappedPresenceMessage<any>> = {}

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
    this.setOnMessage((_msg) => {})
    this.setOnFailure(this.createFailureHandler())
  }

  createFailureHandler() {
    let numErrors = 0
    return (conn: RTCPeerConnection) => {
      numErrors++
      if (numErrors == 3) {
        this.refreshConnections()
      } else if (numErrors > 3) {
        conn.close()
      } else {
        conn.restartIce()
      }
    }
  }

  setOnMessage(func: OnMessage) {
    super.setOnMessage((msg) => {
      func(msg)
      this.peersToLastMsg[msg.sender] = msg
    })
  }

  refreshConnections() {
    let newId = typeof crypto !== 'undefined' ? crypto.randomUUID().slice(0, 5) : 'PLACEHOLDER'
    this.myId = newId
    this.presence.updateState(newId)
    this.setOnFailure(this.createFailureHandler())
  }

  sync(newPeers: string[]) {
    this.setConnMap(
      newPeers.map((peer) => [peer, this.getConn(peer) ?? this.addNewConnection(peer)])
    )
    this.peersToLastMsg = Object.fromEntries(
      Object.entries(this.peersToLastMsg).reduce(
        (a, b) => (newPeers.includes(b[0]) ? [...a, b] : [...a]),
        [] as [string, WrappedPresenceMessage<any>][]
      )
    )
  }

  getPeersToLastMsg() {
    return this.peersToLastMsg
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

  createWebRTCConnection(
    connSetupArray: ChannelCreator[],
    onFailure: (conn: RTCPeerConnection) => void
  ): ChannelSendReceive[] {
    this.conn = createWebRTCConnection(
      (makingOffer: boolean) => {
        this.makingOffer = makingOffer
      },
      this.sendSignalingMessage.bind(this),
      onFailure
    )
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
  sendSignalingMessage: (msg: SignalingMessage) => void,
  onFailure: (conn: RTCPeerConnection) => void
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
    if (conn.connectionState === 'failed') {
      console.log('conn failed, applying onFailure callback')
      onFailure(conn)
    }
  }

  conn.oniceconnectionstatechange = (_e) => {
    console.log(conn.iceConnectionState)
    if (conn.iceConnectionState === 'failed') {
      console.log('conn failed, applying onFailure callback')
      onFailure(conn)
    }
  }

  return conn
}

type AnyFunc = (...args: any[]) => void
function throttle(fn: AnyFunc, durationMs: number): AnyFunc {
  let lastTime = Date.now()
  return (...args) => {
    let curTime = Date.now()
    if (curTime - lastTime > durationMs) {
      fn(...args)
      lastTime = curTime
    }
  }
}
