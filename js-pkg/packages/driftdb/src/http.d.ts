import { MessageFromDb, MessageToDb } from "./types";
export declare class HttpConnection {
    private httpUrl;
    constructor(httpUrl: string);
    send(message: MessageToDb): Promise<MessageFromDb>;
}
//# sourceMappingURL=http.d.ts.map