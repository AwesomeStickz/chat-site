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
    CHANNEL_MEMBER_REMOVE = 12,
    ACK_MESSAGES = 13,
    ACK_MESSAGES_RECEIVED = 14,
    CALL_CREATE = 15,
    CALL_ACK = 16,
    CALL_ACCEPT = 17,
    CALL_REJECT = 18,
    CALL_DATA = 19,
    CALL_END = 20,
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
