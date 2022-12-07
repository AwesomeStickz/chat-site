import { WebSocketEvent } from '../../src/utils/websocketEvents';
import { wsConnections } from '../backend';

export const serverUtils = {
    sendWSMessageToUser: (userID: string, message: WebSocketEvent) => {
        const connsForThisUser = wsConnections.get(userID) || [];

        for (const con of connsForThisUser) con.socket.emit('message', message);
    },
};
