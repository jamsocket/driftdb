import { DRIFTDB_URL } from '@/config'
import Head from 'next/head'
import { DriftDBProvider, RoomQRCode, StatusIndicator, useDatabase, useSharedReducer, useUniqueClientId } from '../components/driftdb-react'

enum Player {
    X = 1,
    O = 0,
}

type GameState = {
    board: number[]
    xIsNext: boolean
    xPlayer: string | null
    oPlayer: string | null
    winner: Player | null
}

type ActionType = {
    type: 'move'
    index: number
    player: string
} | {
    type: 'reset'
}

function ticTacToeReducer(state: GameState, action: ActionType): GameState {
    switch (action.type) {
        case 'reset':
            return {
                board: Array(9).fill(null),
                xIsNext: true,
                xPlayer: null,
                oPlayer: null,
                winner: null,
            }
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
                [2, 4, 6],
            ]
            for (let i = 0; i < lines.length; i++) {
                const [a, b, c] = lines[i]
                if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
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
    } else if (state.board.every(x => x !== null)) {
        return 'Draw!'
    } else if (state.xIsNext) {
        return 'X to play'
    } else {
        return 'O to play'
    }
}

function Square({ value, onClick, disabled }: { value: number, onClick: () => void, disabled: boolean }) {
    return <button className="square" onClick={onClick} disabled={disabled} style={{width: 30, height: 30, background: "none", border: "1px solid #aaa", borderRadius: 3}}>
        {value === Player.X ? 'X' : value === Player.O ? 'O' : '_'}
    </button>
}

function TicTacToeDemo() {
    const [state, dispatch] = useSharedReducer("tictactoe", ticTacToeReducer, {
        board: Array(9).fill(null),
        xIsNext: true,
        xPlayer: null,
        oPlayer: null,
        winner: null,
    })

    const playerId = useUniqueClientId()

    const playMove = (index: number) => {
        dispatch({
            type: 'move',
            index,
            player: playerId,
        })
    }

    const reset = () => {
        dispatch({
            type: 'reset',
        })
    }

    return <div>
        <h1>DriftDB Tic Tac Toe Demo</h1>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2>Game</h2>

            <p>{gameStateDescription(state)}</p>
            
            <div>
                <div>
                    <Square value={state.board[0]} onClick={() => playMove(0)} disabled={state.winner !== null} />
                    <Square value={state.board[1]} onClick={() => playMove(1)} disabled={state.winner !== null} />
                    <Square value={state.board[2]} onClick={() => playMove(2)} disabled={state.winner !== null} />
                </div>
                <div>
                    <Square value={state.board[3]} onClick={() => playMove(3)} disabled={state.winner !== null} />
                    <Square value={state.board[4]} onClick={() => playMove(4)} disabled={state.winner !== null} />
                    <Square value={state.board[5]} onClick={() => playMove(5)} disabled={state.winner !== null} />
                </div>
                <div>
                    <Square value={state.board[6]} onClick={() => playMove(6)} disabled={state.winner !== null} />
                    <Square value={state.board[7]} onClick={() => playMove(7)} disabled={state.winner !== null} />
                    <Square value={state.board[8]} onClick={() => playMove(8)} disabled={state.winner !== null} />
                </div>
            </div>
        </div>
        <p>
            <button onClick={reset}>Reset</button>
        </p>
    </div>
}

export default function Counter() {
    return (
        <>
            <Head>
                <title>DriftDB Demos</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <div>
                <DriftDBProvider api={DRIFTDB_URL}>
                    <StatusIndicator />
                    <TicTacToeDemo />
                    <RoomQRCode />
                </DriftDBProvider>
            </div>
        </>
    )
}
