import * as React from 'react'
import { useWebRTCMessagingChannel } from './webrtc.js'

export const Chat = ({myId, withId}) => {
    let [messages, send]= useWebRTCMessagingChannel(myId, withId)
    console.log(messages)
    const listMessages = messages.map(message =>
	<li key={ message.id }> 
	    <p> { message.text } </p>
	</li>)
    
    return (
	<section>
	    <ol>
	    { listMessages }
	    </ol>
	    <form onSubmit={(e) => {
		e.preventDefault();
		const text = e.target[0].value
		send(text)
	    }}>
		<input type="text" name="mytext"/>
		<button type="submit"> send! </button>
	    </form>
	</section>
    )
}
