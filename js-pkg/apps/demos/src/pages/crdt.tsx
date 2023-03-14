import { DRIFTDB_URL } from '../config'
import { DbConnection } from 'driftdb'
import { DriftDBProvider, RoomQRCode, StatusIndicator, useDatabase } from 'driftdb-react'
import Head from 'next/head'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import 'codemirror/lib/codemirror.css'
import type { Editor } from 'codemirror'
import { Compactable, Compactor } from 'driftdb/dist/compactor'

class YDocCompactable extends Compactable<Y.Doc, Uint8Array> {
  optimistic: boolean = true

  initialState(): Y.Doc {
    return new Y.Doc()
  }

  applyAction(doc: Y.Doc, update: Uint8Array): Y.Doc {
    Y.applyUpdate(doc, update)
    return doc
  }

  packState(state: Y.Doc) {
    return Y.encodeStateAsUpdate(state)
  }

  unpackState(update: Uint8Array) {
    const doc = new Y.Doc()
    Y.applyUpdate(doc, update)
    return doc
  }

  crdt = true
}

function useYDoc(key: string) {
  const [_, setVersion] = useState(0)
  const db = useDatabase()
  const compactor = useRef<Compactor<Y.Doc, Uint8Array> | null>(null)
  if (compactor.current == null) {
    compactor.current = new Compactor({
      db,
      key,
      compactable: new YDocCompactable(),
      callback: () => setVersion((i) => i + 1),
    })
  }

  useEffect(() => {
    compactor.current!.subscribe()
    const doc = compactor.current!.state

    doc.on('update', (update: Uint8Array) => {
      compactor.current!.dispatch(update)
    })
  
    return () => {
      compactor.current!.destroy()
    }
  }, [])

  return compactor.current.state
}

function CrdtDemo() {
  const ydoc = useYDoc('text')
  const editorRef = useRef<Editor | null>(null)

  const codeMirrorRef = useCallback(
    (ref: HTMLTextAreaElement | null) => {
      if (ref == null) {
        if (editorRef.current != null) {
          ;(editorRef.current as any).toTextArea()
          editorRef.current = null
        }
        return
      }

      const CodeMirror = require('codemirror')
      const CodemirrorBinding = require('y-codemirror').CodemirrorBinding
      const yText = ydoc.getText('text')

      editorRef.current = CodeMirror.fromTextArea(ref, {
        lineNumbers: true
      })

      new CodemirrorBinding(yText, editorRef.current)
    },
    [ydoc]
  )

  return (
    <div>
      <h1>CRDT Demo</h1>

      <div>
        <textarea ref={codeMirrorRef} />
      </div>
    </div>
  )
}

export default function Demos() {
  return (
    <>
      <Head>
        <title>DriftDB Demos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div>
        <DriftDBProvider api={DRIFTDB_URL} useBinary={true}>
          <StatusIndicator />
          <CrdtDemo />
          <RoomQRCode />
        </DriftDBProvider>
      </div>
    </>
  )
}
