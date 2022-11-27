import { WebSocketEvent } from '../../src/utils/websocketEvents';
import { wsConnections } from '../websocket';

export const serverUtils = {
    sendWSMessageToUser: (userID: string, message: WebSocketEvent) => {
        const connsForThisUser = wsConnections.get(userID) || [];

        for (const con of connsForThisUser) con.ws.send(JSON.stringify(message));
    },
};
