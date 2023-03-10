import { DRIFTDB_URL } from '../config'
import React, { useState, useCallback, useEffect } from 'react'
import {
  useSharedReducer,
  StatusIndicator,
  useUniqueClientId,
  usePresence,
  DriftDBProvider
} from 'driftdb-react'

type Presence = { name: string; userColor: string; mousePosition: [number, number] | null }
type Shape = { x: number; y: number; w: number; h: number; color: string; id: number }
type SharedCanvas = Shape[]

type CreateShapeAction = { type: 'create-shape'; shape: Shape }
type UpdateShapeAction = { type: 'update-shape'; shape: Shape }
type Actions = CreateShapeAction | UpdateShapeAction

// each user will have their own slice of the color spectrum
const HUE_OFFSET = (Math.random() * 360) | 0
const USER_COLOR = randomColor()

function SharedCanvas() {
  const username = useUniqueClientId()
  const userColor = USER_COLOR
  const [mode, setMode] = useState<'dragging' | 'creating' | null>(null)
  const [selectedShape, setSelectedShape] = useState<number | null>(null)
  const [dragStart, setDragStart] = useState<[number, number] | null>(null)
  const [shapeStart, setShapeStart] = useState<[number, number] | null>(null)
  const [mousePosition, setMousePosition] = useState<[number, number] | null>(null)
  const [sharedCanvas, dispatch] = useSharedReducer<SharedCanvas, Actions>(
    'shared-canvas',
    (state, action) => {
      if (action.type === 'update-shape') {
        const updatedShape = action.shape
        const shape = state.find((s) => s.id === updatedShape.id)
        if (shape) {
          shape.x = updatedShape.x
          shape.y = updatedShape.y
          shape.w = updatedShape.w
          shape.h = updatedShape.h
        }
        return state
      }
      if (action.type === 'create-shape') {
        state.push(action.shape)
        return state
      }
      return state
    },
    []
  )

  const presence = usePresence<Presence>('users', { name: username, mousePosition, userColor })

  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)
  const setContext = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas === null) return
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width
    canvas.height = height
    setCtx(canvas.getContext('2d'))
  }, [])

  useEffect(() => {
    if (ctx) drawCanvas(ctx, sharedCanvas, presence)
  })

  const onMouseDown = (event: React.MouseEvent) => {
    const boundingClientRects = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - boundingClientRects.x
    const y = event.clientY - boundingClientRects.y

    const dragStart: [number, number] = [x, y]

    // detect if mouse is clicking a shape
    let n = sharedCanvas.length
    while (n--) {
      const shape = sharedCanvas[n]
      if (pointRectIntersect(x, y, shape.x, shape.y, shape.w, shape.h)) {
        setMode('dragging')
        setSelectedShape(shape.id)
        setDragStart(dragStart)
        setShapeStart([shape.x, shape.y])
        return
      }
    }

    const id = Math.floor(Math.random() * 100000)
    const newShape = { x, y, w: 0, h: 0, color: randomColor(), id }
    setMode('creating')
    setSelectedShape(newShape.id)
    setDragStart(dragStart)
    dispatch({
      type: 'create-shape',
      shape: newShape
    })
  }

  useEffect(() => {
    function onMouseUp() {
      setMode(null)
      setSelectedShape(null)
      setDragStart(null)
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const onMouseLeave = () => {
    setMousePosition(null)
  }

  const onMouseMove = (event: React.MouseEvent) => {
    const boundingClientRects = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - boundingClientRects.x
    const y = event.clientY - boundingClientRects.y
    setMousePosition([x, y])

    const shape = sharedCanvas.find((s) => s.id === selectedShape)
    if (!mode || !shape || !dragStart) return
    if (mode === 'dragging') {
      if (!shapeStart) throw new Error('Should be a shapeStart here')
      const dx = x - dragStart[0]
      const dy = y - dragStart[1]
      shape.x = shapeStart[0] + dx
      shape.y = shapeStart[1] + dy
    } else if (mode === 'creating') {
      shape.w = Math.abs(dragStart[0] - x)
      shape.h = Math.abs(dragStart[1] - y)
      shape.x = Math.min(dragStart[0], x)
      shape.y = Math.min(dragStart[1], y)
    }
    dispatch({
      type: 'update-shape',
      shape: shape
    })
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
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />
      </div>
    </div>
  )
}

function pointRectIntersect(
  x: number,
  y: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number
) {
  return !(x < rectX || y < rectY || x > rectX + rectW || y > rectY + rectH)
}

function randomColor() {
  const h = (Math.random() * 40 + HUE_OFFSET) % 360 | 0
  const s = (Math.random() * 30 + 25) | 0
  const l = (Math.random() * 30 + 50) | 0
  return `hsl(${h}, ${s}%, ${l}%)`
}

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  sharedCanvas: SharedCanvas,
  presence: ReturnType<typeof usePresence<Presence>>
) {
  if (!ctx) return
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  for (const shape of sharedCanvas) {
    ctx.fillStyle = shape.color
    ctx.fillRect(shape.x, shape.y, shape.w, shape.h)
  }

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
      ctx.strokeStyle = '#eee'
      ctx.lineWidth = 1
      ctx.strokeText(name, mousePosition[0] + 8, mousePosition[1] - 8)
    }
  })
}

export default function App() {
  return (
    <DriftDBProvider api={DRIFTDB_URL} crdt={true}>
      <SharedCanvas />
    </DriftDBProvider>
  )
}
