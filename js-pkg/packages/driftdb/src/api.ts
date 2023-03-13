/**
 * Information about a room returned by the DriftDB Room API.
 */
export interface RoomResult {
  /** The name of the room. */
  room: string

  /** The URL of a WebSocket endpoint that clients can connect to to send messages to the room. */
  socket_url: string

  /** The URL of an HTTP endpoint that clients can `POST` messages to to send a message to the room. */
  http_url: string
}

export interface OutgoingMessage {
  topic: string
  value: any
}

/**
 * Client for the DriftDB Room API. This is used to create new rooms and get
 * information about existing rooms.
 */
export class Api {
  apiUrl: string

  /**
   * Create a new DriftDB Room API client.
   *
   * @param apiUrl The base URL of the DriftDB Room API.
   */
  constructor(apiUrl: string) {
    this.apiUrl = apiUrl
    if (!this.apiUrl.endsWith('/')) {
      this.apiUrl += '/'
    }
  }

  /**
   * Ask the DriftDB server to create a new room and return its information.
   *
   * @returns The room information.
   */
  async newRoom(): Promise<RoomResult> {
    let response = await fetch(`${this.apiUrl}new`, {
      method: 'POST'
    })
    let result = await response.json()
    return result
  }

  /**
   * Get information about an existing room.
   *
   * @param roomId The ID of the room to get information about.
   * @returns The room information.
   */
  async getRoom(roomId: string): Promise<RoomResult> {
    let response = await fetch(`${this.apiUrl}room/${roomId}`)
    let result = await response.json()
    return result
  }
}
