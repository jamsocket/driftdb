export type Key = string
export type SequenceNumber = number

export type Action = {type: 'append' | 'replace' | 'relay'} | {type: 'compact', seq: SequenceNumber}

export interface SequenceValue {
    value: unknown
    seq: SequenceNumber
}

export type MessageFromDb = {
    type: 'push',
    key: Key,
    value: unknown,
    seq: SequenceNumber,
} | {
    type: 'init',
    data: Array<SequenceValue>,
    key: Key,
} | {
    type: 'error',
    message: string
} | {
    type: 'stream_size',
    key: Key,
    size: number
} | {
    type: 'pong',
    nonce?: number,
}

export type MessageToDb = {
    type: 'push'
    action: Action
    value: unknown
    key: Key
} | {
    type: 'get'
    key: Key
    seq: SequenceNumber
} | {
    type: 'ping'
    nonce?: number
}

export type ConnectionStatus = {
    connected: false
} | {
    connected: true
    debugUrl: string
}