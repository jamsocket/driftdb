import * as React from 'react'
import { useDriftDBSignalingChannel } from './signaling'

const channelReducer = (state, action) => {
  switch (action.type) {
    case 'add':
      return [...state, action.message]
    case 'remove':
      return state.slice(action.amount)
  }
}

//from MDN
function set_difference(setA, setB) {
  const _difference = new Set(setA);
  for (const elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
}


/*
export const useWebRTCMessagingChannels = (p1, p2s) => {
    const [
  let [channels, addChannel] = React.useReducer((state, channel) => [...state, channel], [])
    React.useEffect(() => {
	let oldp2s = new Set(...channels.keys())
	let p2s = new Set(p2s)
	for (const elem of set_difference(oldp2s, p2s)) {
	    elem
	}


    }, [p2s])
}
*/
export const useWebRTCMessagingChannel = (p1, p2s) => {
  let theirdataChannelRef = React.useRef([null])
  let [onMessage, setOnMessage] = React.useState(() => (m) => { console.log("unprocessed message", m) })
    const connSetupArrays = p2s.map((p2) => [
    (conn) => {
      let dataChannel = conn.createDataChannel(p1)
      dataChannel.onmessage = (e) => {
	onMessage(e.data)
      }

      conn.ondatachannel = (e) => {
        if (e.channel.label === p2) {
          theirdataChannelRef.current = e.channel
        }
      }
    }
  ])
  useWebRTCConnections(p1, p2s, connSetupArrays)
  return [
    (msg) => {
      try {
        theirdataChannelRef.current?.send(msg)
      } catch (e) {
        console.error(e)
        console.log('unsent: ', msg)
      }
    },
    setOnMessage
  ]
}

export const useWebRTCConnections = (p1, p2s, connSetupArrays) => {
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
      if (conn.iceConnectionState === 'failed') {
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
}
