import * as React from 'react'
import { useDriftDBSignalingChannel } from './driftdbutils'

export const useWebRTCMessagingChannel = (p1, p2) => {
  let [setConnSetupArray] = useWebRTCConnection(p1, p2)
  let [theyAreReady, setTheyAreReady] = React.useState(false)
  let [messages, addMessage] = React.useReducer((state, msg) => [...state, msg], [])
  let theirdataChannelRef = React.useRef(null)

  React.useEffect(() => {
    setConnSetupArray([
      (conn) => {
        let dataChannel = conn.createDataChannel(p1)
        dataChannel.onmessage = (e) => {
          addMessage({ id: e.timeStamp, text: e.data })
        }

        conn.ondatachannel = (e) => {
          if (e.channel.label === p2) {
            setTheyAreReady(true)
            theirdataChannelRef.current = e.channel
          }
        }
      }
    ])

    return () => {
      setTheyAreReady(false)
    }
  }, [p1, p2])

  return [
    messages,
    theyAreReady
      ? theirdataChannelRef.current.send.bind(theirdataChannelRef.current)
      : (msg) => {
          console.log('unsent: ', msg)
        }
  ]
}

export const useWebRTCConnection = (p1, p2) => {
  let [signalingMessages, setSignalingMessages, removeFromRecv] = useDriftDBSignalingChannel(p1, p2)
  const [connSetupArray, setConnSetupArray] = React.useState([])
  const isPeerPolite = p1 < p2
  let connRef = React.useRef(null)
  let makingOfferRef = React.useRef(false)
  React.useEffect(() => {
    console.log('newconning')
    let conn = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    conn.onnegotiationneeded = async () => {
      try {
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
      if (conn.connectionState === 'connected') {
        setIsReady(true)
      } else {
        setIsReady(false)
      }
    }

    conn.oniceconnectionstatechange = (_e) => {
      if (conn.iceConnectionState === 'failed' || conn.iceConnectionState === 'disconnected') {
        console.log('conn failed, restarting ICE')
        conn.restartIce()
      }
    }

    connRef.current = conn

    for (let func of connSetupArray) {
      func(conn)
    }

    return () => {
      conn.close()
    }
  }, [connSetupArray])

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
              throw 'unknown message'
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

  return [setConnSetupArray]
}
