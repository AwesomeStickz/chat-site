import { WebSocket, WebSocketServer } from 'ws';
import { constants } from '../src/utils/constants';
import { WebSocketEvent, WebSocketOP } from '../src/utils/websocketEvents';
import { uid } from './backend';
import { db } from './database';

export const wsConnections = new Map<string, { id: string; sessionID: string; ws: WebSocket; lastPing: number }[]>();

const wss = new WebSocketServer({
    port: constants.websocketPort,
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3,
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024,
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024,
    },
});

wss.on('connection', (ws) => {
    const ids = {
        ws: uid.getUniqueID().toString(),
        user: '',
    };

    ws.on('close', () => {
        const connsForThisUser = wsConnections.get(ids.user) || [];

        for (const con of connsForThisUser) {
            if (con.id === ids.ws) connsForThisUser.splice(connsForThisUser.indexOf(con), 1);
        }

        console.log(`[Websocket]\tConnection closed for user ${ids.user} with id ${ids.ws}! Reason: Connection Closed!`);
    });

    ws.on('message', async (message) => {
        const msg = JSON.parse(message.toString()) as unknown as WebSocketEvent;

        switch (msg.op) {
            case WebSocketOP.HELLO: {
                const { id, sessionID } = msg.d;

                const connsForThisUser = wsConnections.get(id) || [];

                for (const con of connsForThisUser) {
                    if (con.sessionID === sessionID) con.ws.close();
                }

                connsForThisUser.push({ id: ids.ws, sessionID, ws, lastPing: Date.now() });

                wsConnections.set(id, connsForThisUser);
                ids.user = id;

                console.log(`[Websocket]\tUser with ID - ${id} connected in WS ${ids.ws}!`);

                // Send unread messages count mapped by channel ids and pending friend requests count, if any
                const unreadMessages = (
                    await db.query(
                        `
                            SELECT channel_id, COUNT(*) FROM messages
                            WHERE $1 = ANY(unread_users)
                            GROUP BY channel_id;
                        `,
                        [id]
                    )
                ).rows;

                const unreadMessagesObject = {} as Record<string, number>;

                for (const row of unreadMessages) unreadMessagesObject[row.channel_id] = row.count;

                const pendingFriendRequests = (
                    await db.query(
                        `
                            SELECT array_length(friend_requests, 1) AS "count"
                            FROM users
                            WHERE id = $1;
                        `,
                        [id]
                    )
                ).rows[0].count;

                ws.send(JSON.stringify({ op: WebSocketOP.HELLO, d: { unreadMessages: unreadMessagesObject, pendingFriendRequests } }));

                break;
            }
            case WebSocketOP.PING: {
                const connsForThisUser = wsConnections.get(ids.user) || [];

                for (const con of connsForThisUser) {
                    if (con.id === ids.ws) con.lastPing = Date.now();
                }

                wsConnections.set(ids.user, connsForThisUser);

                break;
            }
            case WebSocketOP.ACK_MESSAGES: {
                const { channelID } = msg.d;

                await db.query(
                    `
                        UPDATE messages
                        SET unread_users = array_remove(unread_users, $1)
                        WHERE channel_id = $2;
                    `,
                    [ids.user, channelID]
                );

                ws.send(JSON.stringify({ op: WebSocketOP.ACK_MESSAGES_RECEIVED, d: { channelID } }));
            }
        }
    });
});

setInterval(() => {
    for (const [userID, conns] of wsConnections) {
        for (const conn of conns) {
            if (Date.now() - conn.lastPing > 60000) {
                conn.ws.close();

                console.log(`[Websocket]\tConnection closed for user ${userID} with id ${conn.id}! Reason: Ping timeout!`);
            }
        }
    }
}, 30000);

console.log('[Websocket]\tServer is running!');
