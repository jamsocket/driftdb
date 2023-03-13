import { DRIFTDB_URL } from '../config'
import { DbConnection } from 'driftdb'
import { DriftDBProvider, RoomQRCode, StatusIndicator, useDatabase } from 'driftdb-react'
import Head from 'next/head'
import { useCallback, useRef, useState } from 'react'
import * as Y from 'yjs'
import 'codemirror/lib/codemirror.css'
import type { Editor } from 'codemirror'

class DriftYjsProvider {
  constructor(private db: DbConnection, key: string, public doc: Y.Doc, onUpdate: () => void) {
    let lastSeq = 0

    this.db.subscribe(key, (data) => {
      Y.applyUpdate(doc, data.value as Uint8Array)
      lastSeq = data.seq
    }, (size: number) => {
      if (size > 30) {
        // compact
        let update = Y.encodeStateAsUpdate(doc)
        this.db.send({
          type: 'push',
          key: key,
          value: update,
          action: { type: 'compact', seq: lastSeq }
        })
      }
    })

    doc.on('update', (update: Uint8Array) => {
      this.db.send({
        type: 'push',
        key: key,
        value: update,
        action: { type: 'append' }
      })
      onUpdate()
    })
  }
}

function useYDoc(key: string) {
  const [_, setVersion] = useState(0)
  const db = useDatabase()
  const provider = useRef<DriftYjsProvider | null>(null)
  if (provider.current == null) {
    const doc = new Y.Doc()
    provider.current = new DriftYjsProvider(db, key, doc, () => setVersion((i) => i + 1))
  }

  return provider.current.doc
}

function CrdtDemo() {
  const ydoc = useYDoc('text')
  const editorRef = useRef<Editor | null>(null)

  const codeMirrorRef = useCallback((ref: HTMLTextAreaElement | null) => {
    if (ref == null) {
      if (editorRef.current != null) {
        (editorRef.current as any).toTextArea()
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
  }, [ydoc])

  return <div>
    <h1>CRDT Demo</h1>

    <div>
      <textarea ref={codeMirrorRef} />
    </div>
  </div>
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
