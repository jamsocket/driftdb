import * as React from 'react'
import { useWebRTCConnection, useWebRTCMessagingChannel } from './webrtc.js'
import { useDriftDBSignalingChannel } from './driftdbutils.jsx'

const msgToJsx = (message) => (
  <li key={message.id}>
    <p> {message.text} </p>
  </li>
)
export const Chat = ({ myId, withId }) => {
  let [messages, send] = useWebRTCMessagingChannel(myId, withId)
  let [myMessages, dispatch] = React.useReducer((state, msg) => [...state, msg], [])
  const listMyMessages = myMessages.map(msgToJsx)
  const listMessages = messages.map(msgToJsx)
  return (
    <section>
      <h3> sent </h3>
      <ol>{listMyMessages}</ol>
      <h3> received </h3>
      <ol>{listMessages}</ol>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const text = e.target[0].value
          send(text)
          dispatch({ id: crypto.randomUUID(), text })
        }}
      >
        <input type="text" name="mytext" />
        <button type="submit"> send! </button>
      </form>
    </section>
  )
}
