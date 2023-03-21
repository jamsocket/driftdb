import { DRIFTDB_URL } from '../config'
import React, { useState, useCallback, useEffect } from 'react'
import {
  useSharedReducer,
  StatusIndicator,
  useUniqueClientId,
  usePresence,
    useWebRtcBroadcastChannel,
  DriftDBProvider
} from 'driftdb-react'

const HUE_OFFSET = (Math.random() * 360) | 0
const USER_COLOR = randomColor()

function SharedCanvas() {
  const username = useUniqueClientId()
  const userColor = USER_COLOR
  const [mousePosition, setMousePosition] = useState(null)

  const presence = usePresence('users', { name: username, mousePosition, userColor })

  const [ctx, setCtx] = useState(null)
  const setContext = useCallback((canvas) => {
    if (canvas === null) return
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width
    canvas.height = height
    setCtx(canvas.getContext('2d'))
  }, [])


    useEffect(() => {
	if (ctx) drawCanvas(ctx, presence)
    })

  const onMouseLeave = () => {
    setMousePosition(null)
  }

  const onMouseMove = (event) => {
    const boundingClientRects = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - boundingClientRects.x
    const y = event.clientY - boundingClientRects.y
    setMousePosition([x, y])
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">DriftDB - Shared Canvas Demo</h1>
        <StatusIndicator />
      </div>
      <div className="mt-8">
        <canvas
          ref={setContext}
          className="w-full bg-gray-800 rounded-xl h-full"
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />
      </div>
    </div>
  )
}

function randomColor() {
  const h = (Math.random() * 40 + HUE_OFFSET) % 360 | 0
  const s = (Math.random() * 30 + 25) | 0
  const l = (Math.random() * 30 + 50) | 0
  return `hsl(${h}, ${s}%, ${l}%)`
}

function drawCanvas(
    ctx,
    presence
) {
  if (!ctx) return
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    console.log(presence)

  // draw users' cursors as dots
  Object.values(presence).map((user) => {
    const { mousePosition, userColor, name } = user.value
    if (mousePosition) {
      ctx.beginPath()
      ctx.fillStyle = userColor
      ctx.moveTo(mousePosition[0], mousePosition[1])
      ctx.arc(mousePosition[0], mousePosition[1], 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = '12px monospace'
      ctx.fillText(name, mousePosition[0] + 8, mousePosition[1] - 8)
      ctx.fillText("SLDKFJS", mousePosition[0] + 8, mousePosition[1] - 8)
      ctx.strokeStyle = '#eee'
      ctx.lineWidth = 1
      ctx.strokeText(name, mousePosition[0] + 8, mousePosition[1] - 8)
    }
  })
}

export default function App() {
  return (
    <DriftDBProvider api={DRIFTDB_URL} useBinary={true}>
      <SharedCanvas />
    </DriftDBProvider>
  )
}
