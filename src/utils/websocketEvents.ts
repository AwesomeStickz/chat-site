export enum WebSocketOP {
    HELLO = 0,
    PING = 1,
    PONG = 2,
    MESSAGE_CREATE = 3,
    MESSAGE_UPDATE = 4,
    MESSAGE_DELETE = 5,
}

export interface WebSocketEvent {
    op: WebSocketOP;
    d: any;
}

export interface WSHelloPayload {
    op: WebSocketOP.HELLO;
    d: {
        id: string;
    };
}
