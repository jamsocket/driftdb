import { DRIFTDB_URL } from '../config'
import Head from 'next/head'
import { XMarkIcon } from '@heroicons/react/20/solid'
import {
  DriftDBProvider,
  RoomQRCode,
  StatusIndicator,
  useSharedReducer,
  useUniqueClientId
} from 'driftdb-react'

enum Player {
  X = 1,
  O = 0
}

type GameState = {
  board: number[]
  xIsNext: boolean
  xPlayer: string | null
  oPlayer: string | null
  winner: Player | null
}

type ActionType =
  | {
      type: 'move'
      index: number
      player: string
    }
  | {
      type: 'reset'
    }

const INITIAL_STATE: GameState = {
  board: Array(9).fill(null),
  xIsNext: true,
  xPlayer: null,
  oPlayer: null,
  winner: null
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

function ticTacToeReducer(oldState: GameState, action: ActionType): GameState {
  const state = structuredClone(oldState)
  switch (action.type) {
    case 'reset':
      return structuredClone(INITIAL_STATE)
    case 'move':
      if (state.xIsNext) {
        if (state.xPlayer === null) {
          state.xPlayer = action.player
        } else if (state.xPlayer !== action.player) {
          // Out of turn.
          return state
        }
      } else {
        if (state.oPlayer === null && state.xPlayer !== action.player) {
          state.oPlayer = action.player
        } else if (state.oPlayer !== action.player) {
          // Out of turn.
          return state
        }
      }

      if (state.board[action.index] !== null) {
        // Already taken.
        return state
      }

      state.board[action.index] = state.xIsNext ? Player.X : Player.O

      let winner = null
      const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
      ]
      for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i]
        if (
          state.board[a] !== null &&
          state.board[a] === state.board[b] &&
          state.board[a] === state.board[c]
        ) {
          winner = state.board[a]
        }
      }

      state.winner = winner
      state.xIsNext = !state.xIsNext
      return state
    default:
      return state
  }
}

function gameStateDescription(state: GameState) {
  if (state.winner === Player.X) {
    return 'X wins!'
  } else if (state.winner === Player.O) {
    return 'O wins!'
  } else if (state.board.every((x) => x !== null)) {
    return 'Draw!'
  } else if (state.xIsNext) {
    return 'X to play'
  } else {
    return 'O to play'
  }
}

function Square({
  value,
  onClick,
  disabled
}: {
  value: number
  onClick: () => void
  disabled: boolean
}) {
  return (
    <div
      className={classNames(
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        'w-20 h-20 p-3 border border-gray-600'
      )}
      onClick={() => {
        disabled ? null : onClick()
      }}
    >
      {value === Player.X ? (
        <XMarkIcon className="h-full w-full" />
      ) : value === Player.O ? (
        <CircleIcon className="h-full w-full" />
      ) : (
        ''
      )}
    </div>
  )
}

function TicTacToeDemo() {
  const [state, dispatch] = useSharedReducer('tictactoe', ticTacToeReducer, null, () =>
    structuredClone(INITIAL_STATE)
  )

  const playerId = useUniqueClientId()

  const playMove = (index: number) => {
    dispatch({
      type: 'move',
      index,
      player: playerId
    })
  }

  const reset = () => {
    dispatch({
      type: 'reset'
    })
  }

  return (
    <div className="mb-8 mt-4 inline-flex flex-col">
      <div className="mb-4">
        <p className="text-sm mb-3 text-gray-600 uppercase text-center py-1 bg-gray-200 border border-gray-300 rounded-md">
          {gameStateDescription(state)}
        </p>

        <div className="flex-col border border-gray-500 inline-flex">
          <div className="flex flex-row">
            <Square
              value={state.board[0]}
              onClick={() => playMove(0)}
              disabled={state.winner !== null}
            />
            <Square
              value={state.board[1]}
              onClick={() => playMove(1)}
              disabled={state.winner !== null}
            />
            <Square
              value={state.board[2]}
              onClick={() => playMove(2)}
              disabled={state.winner !== null}
            />
          </div>
          <div className="flex flex-row">
            <Square
              value={state.board[3]}
              onClick={() => playMove(3)}
              disabled={state.winner !== null}
            />
            <Square
              value={state.board[4]}
              onClick={() => playMove(4)}
              disabled={state.winner !== null}
            />
            <Square
              value={state.board[5]}
              onClick={() => playMove(5)}
              disabled={state.winner !== null}
            />
          </div>
          <div className="flex flex-row">
            <Square
              value={state.board[6]}
              onClick={() => playMove(6)}
              disabled={state.winner !== null}
            />
            <Square
              value={state.board[7]}
              onClick={() => playMove(7)}
              disabled={state.winner !== null}
            />
            <Square
              value={state.board[8]}
              onClick={() => playMove(8)}
              disabled={state.winner !== null}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={reset}
        className="rounded bg-gray-50 py-1.5 px-3 text-md text-gray-800 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-100"
      >
        Reset
      </button>
    </div>
  )
}

export default function TicTacToe() {
  return (
    <>
      <Head>
        <title>DriftDB Demos</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div>
        <DriftDBProvider api={DRIFTDB_URL}>
          <h1 className="text-2xl font-bold text-gray-800">DriftDB - Tic Tac Toe Demo</h1>
          <TicTacToeDemo />
          <div className="flex flex-col gap-4 sm:max-w-sm border border-gray-300 bg-gray-200 p-6 rounded-3xl">
            <StatusIndicator />
            <div className="overflow-hidden rounded-3xl">
              <RoomQRCode />
            </div>
          </div>
        </DriftDBProvider>
      </div>
    </>
  )
}
function CircleIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 28 28"
      stroke-width="2"
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M23 14a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
