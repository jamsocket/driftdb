import * as React from 'react'
import { useWebRTCMessagingChannel } from './webrtc.js'

const msgToJsx = (message) => (
  <li key={message.id} className="p-3">
    <p> {message.text} </p>
  </li>
)
export const Chat = ({ myId, withId }) => {
  let [messages, send, latency] = useWebRTCMessagingChannel(myId, withId)
  let [myMessages, dispatch] = React.useReducer((state, msg) => [...state, msg], [])
  const listMyMessages = myMessages.map(msgToJsx)
  const listMessages = messages.map(msgToJsx)

  return (
    <section className="border border-green-800 p-4 w-1/2">
      <h3 className="border text-lg px-3 font-bold"> sent </h3>
      <ul className="border m-3">{listMyMessages}</ul>
      <h3 className="border text-lg px-3 font-bold"> received </h3>
      <ul className="border m-3">{listMessages}</ul>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const text = e.target[0].value
          e.target[0].value = ''
          send(text)
          dispatch({ id: crypto.randomUUID(), text })
        }}
      >
        <input
          className="w-3/4 focus:border-blue-500 px-3"
          placeholder="Enter text here"
          type="text"
          name="mytext"
        />
        <button
          className="mx-4 border p-2 rounded-full fill-blue-500 hover:fill-green-500"
          type="submit"
        >
          send!
        </button>
        Latency: {latency} ms
      </form>
    </section>
  )
}
