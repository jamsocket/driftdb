import { Action, MessageToDb } from "driftdb/dist/types";
import { useState } from "react";
import ActionInput from "./ActionInput";
import TextInput from "./TextInput";

interface MessageToDbFormProps {
    onSend: (message: MessageToDb) => void;
}

export default function MessageToDbForm(props: MessageToDbFormProps): JSX.Element {
    const [key, setKey] = useState("");
    const [message, setMessage] = useState("");
    const [action, setAction] = useState<Action>({type: "replace"});

    const sendMessage = () => {
        props.onSend({
            type: "push",
            key,
            value: message,
            action,
        });
        
        setMessage("");
    }

    return <div className="flex space-x-4">
        <ActionInput value={action} onChange={setAction} />

        <div className="flex-[2_2_0%]">
            <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2" htmlFor="grid-first-name">
                Key
            </label>
            <TextInput placeholder="Key" value={key} setValue={setKey} />
        </div>

        <div className="flex-[6_6_0%]">
            <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2">
                Message
            </label>
            <TextInput placeholder="Message" value={message} setValue={setMessage} />
        </div>

        <div className="flex-[1_1_0%]">
            <label className="block uppercase tracking-wide text-gray-700 text-xs font-bold mb-2">
                &nbsp;
            </label>

            <input className="appearance-none block w-full bg-lime-200 text-lime-700 border rounded py-3 px-4 mb-3 leading-tight focus:outline-none hover:bg-lime-400" type="button" value="Send" onClick={sendMessage} />
        </div>
    </div>
}