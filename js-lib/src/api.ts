export interface RoomResult {
    room: string,
    url: string,
}

export interface OutgoingMessage {
    topic: string,
    value: any,
}

export interface IncomingMessage {
    topic: string,
    clientId: number,
    value: any,
    sequence: number,
    timestamp: number,
}

export class Api {
    apiUrl: string;

    constructor(apiUrl: string) {
        this.apiUrl = apiUrl;
        if (!this.apiUrl.endsWith('/')) {
            this.apiUrl += '/'
        }
    }

    async newRoom(): Promise<RoomResult> {
        let response = await fetch(`${this.apiUrl}new`, {
            method: "POST",
        });
        let result = await response.json();
        return result;
    }

    async getRoom(roomId: string): Promise<RoomResult> {
        let response = await fetch(`${this.apiUrl}room/${roomId}`);
        let result = await response.json();
        return result;
    }
}