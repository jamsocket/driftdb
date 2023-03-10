import { MessageFromDb, MessageToDb } from './types'

export class HttpConnection {
  constructor(private httpUrl: string) {}

  send(message: MessageToDb): Promise<MessageFromDb> {
    return fetch(this.httpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`)
      }
      return response.json()
    })
  }
}
