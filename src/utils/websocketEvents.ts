export enum WebSocketOP {
    HELLO = 0,
    PING = 1,
    PONG = 2,
    MESSAGE_CREATE = 3,
    MESSAGE_UPDATE = 4,
    MESSAGE_DELETE = 5,
    FRIEND_REQ_SEND = 6,
    FRIEND_REQ_ACCEPT = 8,
    FRIEND_REQ_REJECT = 9,
    FRIEND_REQ_DELETE = 10,
    CHANNEL_CREATE = 11,
    ACK_MESSAGES = 12,
    ACK_MESSAGES_RECEIVED = 13,
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
