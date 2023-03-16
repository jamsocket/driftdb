import * as React from 'react'
import { useWebRTCMessagingChannel } from './webrtc.js'

function formatNumber(num, digits) {
  const div = Math.pow(10, digits)
  return Math.round(num / div) * div
}

const msgToJsx = (message) => {
  const classes = ['leading-8', message.mine ? 'font-bold' : ''].filter(Boolean).join(' ')
  return (
    <li key={message.id} className={classes}>
      <p> {message.text} </p>
    </li>
  )
}
export const Chat = ({ myId, withId, driftDBLatency, sessionPeer }) => {
  let [messages, send, latency] = useWebRTCMessagingChannel(myId, withId)
  let [myMessages, dispatch] = React.useReducer((state, msg) => [...state, msg], [])

  const allMessages = messages.slice()
  allMessages.push(...myMessages)
  allMessages.sort((a, b) => a.timestamp - b.timestamp)

  return (
    <li
      key={sessionPeer}
      className="flex flex-col justify-between border bg-gray-50 rounded-lg border-gray-200 my-4 w-full max-w-sm overflow-hidden"
    >
      <h3 className="uppercase text-gray-500 text-center text-sm font-bold py-3 border-b border-gray-300 bg-white">
        Chat with {sessionPeer}
      </h3>
      <section className="flex py-2 content-center flex-col justify-between">
        <div className="px-4 py-2">
          {allMessages.length > 0 ? (
            <>
              <ul className="">{allMessages.map(msgToJsx)}</ul>
            </>
          ) : null}
          <form
            className="flex gap-2 my-4"
            onSubmit={(e) => {
              e.preventDefault()
              const text = e.target[0].value
              e.target[0].value = ''
              send(text)
              dispatch({ id: crypto.randomUUID(), text, timestamp: Date.now(), mine: true })
            }}
          >
            <input
              className="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-indigo-600 leading-6"
              placeholder="Type a message"
              type="text"
              name="mytext"
            />
            <button
              type="submit"
              class="rounded-md bg-indigo-600 py-2 px-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Send!
            </button>
          </form>
        </div>
        <div className="pt-4 pb-2 px-4 border-t text-sm leading-6 text-gray-500">
          <div>
            <span className="text-gray-500">WebRTC Latency:</span>
            <span className="ml-2 font-bold">
              {latency ? formatNumber(latency, 4) + ' ms' : 'Not reported'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">DriftDB Latency:</span>
            <span className="ml-2 font-bold">
              {driftDBLatency ? formatNumber(driftDBLatency, 2) + ' ms' : 'Not reported'}
            </span>
          </div>
        </div>
      </section>
    </li>
  )
}
