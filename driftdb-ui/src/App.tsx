import { DbConnection } from "driftdb";
import { MessageFromDb, MessageToDb, SequenceValue } from "driftdb/dist/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import MessageToDbForm from "./components/MessageToServerForm";
import PrettyJson from "./components/PrettyJson";
import { StatusIndicator } from "./db-react";

interface MessageProps {
  message: MessageFromDb;
}

function Message(props: MessageProps) {
  return (
    <PrettyJson value={props.message} />
  );
}

function App() {
  let [messages, setMessages] = useState<Array<MessageFromDb>>([])
  let [keyState, setKeyState] = useState<Record<string, Array<SequenceValue>>>({})
  let [autoRefreshState, setAutoRefreshState] = useState(true)

  let db = useMemo(() => {
    // Check for URL in query string if it exists.
    let url = new URL(window.location.href)
    let socketUrl
    if (url.searchParams.has("url")) {
      socketUrl = url.searchParams.get("url")!
    } else {
      socketUrl = "ws://localhost:8080/api/ws"
    }

    if (autoRefreshState) {
      socketUrl += "?debug=true"
    }

    const db = new DbConnection()
    db.connect(socketUrl)

    db.send({
      type: "dump",
      prefix: [],
    })

    return db
  }, []);

  useEffect(() => {
    const listener = (message: MessageFromDb) => {
      if (message.type === "init") {
        const keyState: Record<string, Array<SequenceValue>> = {}
        for (let [key, value] of message.data) {
          keyState[JSON.stringify(key)] = value
        }
        setKeyState(keyState)
        setMessages([message])
      } else if (message.type === "push" && message.value.seq !== undefined) {
        const key = JSON.stringify(message.key)
        setKeyState((keyState) => {
          const value = keyState[key] || []
          return {
            ...keyState,
            [key]: [...value, message.value]
          }
        })
        setMessages((messages) => [...messages, message])
      } else {
        setMessages((messages) => [...messages, message])
      }
    };

    db.messageListener.addListener(listener)

    return () => {
      db.messageListener.removeListener(listener)
    }
  }, [db])

  const onSend = useCallback((message: MessageToDb) => {
    db.send(message);
  }, [db])

  const refreshState = useCallback(() => {
    db.send({
      type: "dump",
      prefix: [],
    })
  }, [])

  return (
    <div className="container mx-auto flex flex-col space-y-2 py-6">
      <div className="flex flex-row space-x-8 items-center mb-4">
        <div className="grow flex flex-row space-x-4">
          <h1 className="font-bold">DriftDB</h1>
          <StatusIndicator database={db} />

          {
            autoRefreshState ? null : <button className="appearance-none text-sm block bg-lime-200 text-lime-700 border rounded leading-tight hover:bg-lime-400 py-0.5 px-3" onClick={refreshState}>Refresh State</button>
          }

          <div>
            <label className="text-sm">
              <input type="checkbox" checked={autoRefreshState} onChange={(e) => setAutoRefreshState(e.target.checked)} />
              {" "}Auto Refresh State
            </label>
          </div>
        </div>
      </div>

      <MessageToDbForm onSend={onSend} />

      <div className="flex flex-row space-x-4">
        <div className="grow flex-1">
          <h2 className="font-bold mb-2">State</h2>
          <div className="flex-col space-y-4">
            {
              Object.entries(keyState).map(([key, value]) => {
                const keyStr = JSON.parse(key).join('.') || <em>root</em>

                return <div key={key} className="flex-col space-y-4 bg-gray-100 rounded-lg p-4 overflow-y-scroll font-mono">
                  <div className="text-lg font-bold">{keyStr}</div>
                  {value.map((value, i) => (
                    <div key={i} className="text-sm"><PrettyJson value={value} /></div>
                  ))}
                </div>
              })
            }
          </div>
        </div>

        <div className="grow flex-1">
          <h2 className="font-bold mb-2">Messages</h2>
          <div className="flex flex-col space-y-4 bg-gray-100 rounded-lg p-4 overflow-y-scroll font-mono">
            {messages.map((message, i) => (
              <div key={i} className="text-sm"><Message message={message} /></div>
            ))}
          </div>
        </div>
      </div>
    </div >
  );
}


export default App;
