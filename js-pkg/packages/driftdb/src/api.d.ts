export interface RoomResult {
    room: string;
    socket_url: string;
    http_url: string;
}
export interface OutgoingMessage {
    topic: string;
    value: any;
}
export declare class Api {
    apiUrl: string;
    constructor(apiUrl: string);
    newRoom(): Promise<RoomResult>;
    getRoom(roomId: string): Promise<RoomResult>;
}
//# sourceMappingURL=api.d.ts.map