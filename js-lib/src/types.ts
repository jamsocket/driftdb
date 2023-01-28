export type Key = Array<string>
export type SequenceNumber = number

export type Action = {type: 'append' | 'replace' | 'relay'} | {type: 'compact', seq: SequenceNumber}

export interface SequenceValue {
    value: any
    seq: SequenceNumber
}

export type MessageFromDb = {
    type: 'push',
    key: Key,
    value: SequenceValue,
} | {
    type: 'init',
    prefix: Key,
    data: Array<[Key, Array<SequenceValue>]>
} | {
    type: 'error',
    message: string
} | {
    type: 'stream_size',
    key: Key,
    size: number
}

export type MessageToDb = {
    type: 'push'
    action: Action
    value: any
    key: Key
} | {
    type: 'dump'
    prefix: Key
}

export type ConnectionStatus = {
    connected: false
} | {
    connected: true
    debugUrl: string
}