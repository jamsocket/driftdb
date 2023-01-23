export type LaxSubject = string | Array<string>
export type Subject = Array<string>
export type SequenceNumber = number

export type Action = {type: 'append' | 'replace' | 'relay'} | {type: 'compact', seq: SequenceNumber}

export interface SequenceValue {
    value: any
    seq: SequenceNumber
}

export type MessageFromDb = {
    type: 'push',
    key: Subject,
    value: SequenceValue,
} | {
    type: 'init',
    prefix: Subject,
    data: Array<[Subject, Array<SequenceValue>]>
} | {
    type: 'error',
    message: string
} | {
    type: 'subject_size',
    key: Subject,
    size: number
}

export type MessageToDb = {
    type: 'push'
    action: Action
    value: any
    key: LaxSubject
} | {
    type: 'dump'
    prefix: LaxSubject
}

export type ConnectionStatus = {
    connected: false
} | {
    connected: true
    debugUrl: string
}