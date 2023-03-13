import * as React from 'react'
import { useDriftDBSignalingChannel } from './signaling'

export const useWebRTCMessagingChannel = (p1, p2) => {
  let theirdataChannelRef = React.useRef(null)
  let [messages, addMessage] = React.useReducer((state, msg) => [...state, msg], [])
  let [latency, setLatency] = React.useState(0)
  const connSetupArray = React.useRef([
    (conn) => {
      let dataChannel = conn.createDataChannel(p1)
      dataChannel.onmessage = (e) => {
        addMessage({ id: e.timeStamp, text: e.data })
      }

      conn.ondatachannel = (e) => {
        if (e.channel.label === p2) {
          theirdataChannelRef.current = e.channel
        }
      }
    }
  ])
  const getLatency = useWebRTCConnection(p1, p2, connSetupArray.current)
  React.useEffect(() => {
    setTimeout(async function l() {
      try {
        const _lat = await getLatency()
        setLatency(_lat)
      } catch (e) {}
    }, 1000)
  }, [])
  return [
    messages,
    (msg) => {
      try {
        theirdataChannelRef.current?.send(msg)
      } catch (e) {
        console.error(e)
        console.log('unsent: ', msg)
      }
    },
    latency
  ]
}

export const useWebRTCConnection = (p1, p2, connSetupArray) => {
  let [signalingMessages, setSignalingMessages, removeFromRecv] = useDriftDBSignalingChannel(p1, p2)
  const isPeerPolite = p1 < p2
  let connRef = React.useRef(null)
  let makingOfferRef = React.useRef(false)

  React.useEffect(() => {
    console.log('new connection')
    let conn = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    conn.onnegotiationneeded = async () => {
      try {
        console.log('sending offer')
        makingOfferRef.current = true
        await conn.setLocalDescription()
        setSignalingMessages({ type: 'offer', sdp: conn.localDescription.sdp })
      } catch (e) {
        console.error(e)
      } finally {
        makingOfferRef.current = false
      }
    }

    conn.onicecandidate = (e) => {
      let candidate = e.candidate
      setSignalingMessages({ type: 'candidate', candidate })
    }

    conn.onconnectionstatechange = () => {
      console.log('current webrtc connection state: ', conn.connectionState)
    }

    conn.oniceconnectionstatechange = (_e) => {
      if (conn.iceConnectionState === 'failed' || conn.iceConnectionState === 'disconnected') {
        console.log('conn failed, restarting ICE')
        conn.restartIce()
      }
    }

    connRef.current = conn

    for (let func of connSetupArray ?? []) {
      func(conn)
    }

    return () => {
      conn.close()
    }
  }, [])

  React.useEffect(() => {
    ;(async () => {
      let conn = connRef.current
      let makingOffer = makingOfferRef.current
      const offerCollides = makingOffer || conn.signalingState !== 'stable'
      const ignoreOffer = !isPeerPolite && offerCollides
      let processed = 0
      try {
        for (let msg of signalingMessages) {
          console.log(msg)
          processed++
          switch (msg.type) {
            case 'answer':
              await conn.setRemoteDescription(msg)
              break
            case 'offer':
              if (ignoreOffer) break
              await conn.setRemoteDescription(msg)
              await conn.setLocalDescription()
              setSignalingMessages({ type: 'answer', sdp: conn.localDescription.sdp })
              break
            case 'candidate':
              try {
                await conn.addIceCandidate(msg.candidate)
              } catch (err) {
                if (!ignoreOffer) throw err
              }
              break
            default:
              throw new Error('unknown message')
          }
        }
      } catch (e) {
        console.error(e)
        console.error('failed conn manip')
      } finally {
        if (processed > 0) removeFromRecv(processed)
      }
    })()
  }, [signalingMessages])

  const getLatency = async () => {
    const stats = await connRef.current?.getStats(null)

    for (const [_, st] of stats ?? []) {
      if (st.type === 'candidate-pair') {
        if (typeof st.currentRoundTripTime === 'number') {
          return st.currentRoundTripTime / 2
        } else {
          throw new Error('current round trip time not reported!')
        }
      }
    }
  }
  return getLatency
}
