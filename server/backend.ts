import bodyParser from 'body-parser';
import pgSession from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import http from 'http';
import { Snowflake } from 'nodejs-snowflake';
import { Server } from 'socket.io';
import { constants } from '../src/utils/constants';
import { WebSocketEvent, WebSocketOP } from '../src/utils/websocketEvents';
import { db } from './database';
import { routers } from './routers';
import './utils/pgErrorHandler';

export const uid = new Snowflake({ custom_epoch: 0 });

const app = express();

export const server = http.createServer(app);

app.set('trust proxy', true);

app.use(function (_req, res, next) {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-HTTP-Method-Override, Set-Cookie, Cookie');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');

    next();
});

app.use(cors({ origin: constants.frontendBaseURL }));

app.use(bodyParser.json({ limit: '125mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '125mb' }));

const sessionParser = session({
    store: new (pgSession(session))({
        pool: db,
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
});

app.use(sessionParser);
app.use(cookieParser());

app.use('/api', routers.API);
app.use('/oauth', routers.OAuth);

// app.use(express.static(path.join(__dirname, '../../', 'build')));

// app.get('/*', (_req, res) => {
//     res.sendFile(path.join(__dirname, '../../', 'build', 'index.html'));
// });

server.listen(constants.backendPort);

export const wsConnections = new Map<string, { id: string; sessionID: string; socket: any; lastPing: number }[]>();

const io = new Server(server);

io.on('connection', (socket) => {
    const ids = {
        ws: uid.getUniqueID().toString(),
        user: '',
    };

    socket.on('disconnect', () => {
        const connsForThisUser = wsConnections.get(ids.user) || [];

        for (const con of connsForThisUser) {
            if (con.id === ids.ws) connsForThisUser.splice(connsForThisUser.indexOf(con), 1);
        }

        console.log(`[Websocket]\tConnection closed for user ${ids.user} with id ${ids.ws}! Reason: Connection Closed!`);
    });

    socket.on('message', async (message: WebSocketEvent) => {
        switch (message.op) {
            case WebSocketOP.HELLO: {
                const { id, sessionID } = message.d;

                const connsForThisUser = wsConnections.get(id) || [];

                for (const con of connsForThisUser) {
                    if (con.sessionID === sessionID) con.socket.disconnect();
                }

                connsForThisUser.push({ id: ids.ws, sessionID, socket, lastPing: Date.now() });

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

                socket.send({ op: WebSocketOP.HELLO, d: { unreadMessages: unreadMessagesObject, pendingFriendRequests } });

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
                const { channelID } = message.d;

                await db.query(
                    `
                        UPDATE messages
                        SET unread_users = array_remove(unread_users, $1)
                        WHERE channel_id = $2;
                    `,
                    [ids.user, channelID]
                );

                socket.send({ op: WebSocketOP.ACK_MESSAGES_RECEIVED, d: { channelID } });

                break;
            }
            case WebSocketOP.CALL_CREATE: {
                const { channelID } = message.d;

                const otherUserInThisChannel = (
                    await db.query(
                        `
                            SELECT users
                            FROM channels
                            WHERE id = $1;
                            `,
                        [channelID]
                    )
                ).rows[0]?.users.filter((u: string) => u !== ids.user)[0];

                const userData = (
                    await db.query(
                        `
                            SELECT id, username
                            FROM users
                            WHERE id IN ($1, $2);
                        `,
                        [ids.user, otherUserInThisChannel]
                    )
                ).rows;

                const connsForOtherUser = wsConnections.get(otherUserInThisChannel) || [];

                for (const con of connsForOtherUser) {
                    con.socket.send({ op: WebSocketOP.CALL_CREATE, d: { channelID, username: userData.find((user: any) => user.id === ids.user).username } });
                }

                const connsForThisUser = wsConnections.get(ids.user) || [];

                for (const con of connsForThisUser) {
                    con.socket.send({ op: WebSocketOP.CALL_ACK, d: { channelID, username: userData.find((user: any) => user.id === otherUserInThisChannel).username } });
                }

                break;
            }
            case WebSocketOP.CALL_ACCEPT: {
                const { channelID } = message.d;

                const otherUserInThisChannel = (
                    await db.query(
                        `
                            SELECT users
                            FROM channels
                            WHERE id = $1;
                            `,
                        [channelID]
                    )
                ).rows[0]?.users.filter((u: string) => u !== ids.user)[0];

                const connsForOtherUser = wsConnections.get(otherUserInThisChannel) || [];

                for (const con of connsForOtherUser) {
                    con.socket.send({ op: WebSocketOP.CALL_ACCEPT, d: { channelID } });
                }

                break;
            }
            case WebSocketOP.CALL_REJECT: {
                const { channelID } = message.d;

                const otherUserInThisChannel = (
                    await db.query(
                        `
                            SELECT users
                            FROM channels
                            WHERE id = $1;
                            `,
                        [channelID]
                    )
                ).rows[0]?.users.filter((u: string) => u !== ids.user)[0];

                const connsForOtherUser = wsConnections.get(otherUserInThisChannel) || [];

                for (const con of connsForOtherUser) {
                    con.socket.send({ op: WebSocketOP.CALL_REJECT, d: { channelID } });
                }

                break;
            }
            case WebSocketOP.CALL_END: {
                const { channelID } = message.d;

                const usersInThisChannel = (
                    await db.query(
                        `
                            SELECT users
                            FROM channels
                            WHERE id = $1;
                        `,
                        [channelID]
                    )
                ).rows[0].users;

                for (const user of usersInThisChannel) {
                    const connsForThisUser = wsConnections.get(user) || [];

                    for (const con of connsForThisUser) {
                        con.socket.send({ op: WebSocketOP.CALL_END, d: { channelID } });
                    }
                }

                break;
            }
            case WebSocketOP.CALL_DATA: {
                const id = message.d.id;
                const room = message.d.channelID;

                socket.join(room);
                socket.to(room).emit('message', { op: WebSocketOP.CALL_DATA, d: { type: 'userJoined', id } });
                socket.on('disconnect', () => {
                    socket.to(room).emit('message', { op: WebSocketOP.CALL_DATA, d: { type: 'userDisconnect', id } });
                });

                break;
            }
        }
    });

    socket.on('call', (blob) => {
        socket.emit('call', blob);
    });
});

setInterval(() => {
    for (const [userID, conns] of wsConnections) {
        for (const conn of conns) {
            if (Date.now() - conn.lastPing > 60000) {
                conn.socket.disconnect();

                console.log(`[Websocket]\tConnection closed for user ${userID} with id ${conn.id}! Reason: Ping timeout!`);
            }
        }
    }
}, 30000);

console.log('[Websocket]\tServer is running!');

process.on('unhandledRejection', (error) => {
    console.error('Uncaught Promise Error: ', error);
});

console.log('Backend Started and is Running!');
