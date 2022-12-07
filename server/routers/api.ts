import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { constants } from '../../src/utils/constants';
import { WebSocketOP } from '../../src/utils/websocketEvents';
import { uid } from '../backend';
import { db } from '../database';
import { serverUtils } from '../utils/serverUtils';

export const router = Router();

const makeRateLimiter = (allowedRequestsPerMinute: number) =>
    rateLimit({
        windowMs: 60 * 1000,
        max: allowedRequestsPerMinute,
        handler: (_req, res) => res.status(429).send(),
    });

const sendResponse = (res: Response, status: number, body?: any) => {
    if (body) res.status(status).send(body);
    else res.status(status).send();
};

const handleAuthorizationCheck = (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) return sendResponse(res, 401);
    if (req.cookies.loggedIn !== 'true') return res.redirect(`${constants.backendBaseURL}/oauth/logout`);

    next();
};

router.post('/register', makeRateLimiter(15), async (req, res) => {
    const { username } = req.body;
    if (!req.session.user || !username) return sendResponse(res, 400);

    await db.query(
        `
            UPDATE users
            SET username = $1
            WHERE id = $2;
        `,
        [username, req.session.user.id]
    );

    req.session.user.username = username;

    res.cookie('loggedIn', 'true', { maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('id', req.session.user.id, { maxAge: 7 * 24 * 60 * 60 * 1000 });

    sendResponse(res, 200);
});

router.get('/channels', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const channels = (
        await db.query(
            `
                SELECT
                    *,
                    last_active_at AS "lastActiveAt"
                FROM channels
                WHERE $1 = ANY(users);
            `,
            [req.session.user.id]
        )
    ).rows;

    const userIDsToFetch = channels
        .map((channel) => channel.users)
        .flat()
        .filter((userID) => userID !== req.session.user.id);

    const users = (
        await db.query(
            `
                SELECT id, username, avatar
                FROM users
                WHERE id = ANY($1);
            `,
            [userIDsToFetch]
        )
    ).rows;

    channels.map((channel) => {
        // Set channel's name and icon to the other user's username and avatar if it's a DM
        if (channel.type === 'dm') {
            const otherUser = users.find((user) => user.id !== req.session.user.id && channel.users.includes(user.id));

            channel.name = otherUser.username;
            channel.icon = otherUser.avatar;
        }
    });

    sendResponse(res, 200, channels);
});

router.post('/channels', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { type, users } = req.body;
    if (!users || !type || type !== 'group') return sendResponse(res, 400);

    const channelID = uid.getUniqueID().toString();

    const channel = {
        id: channelID,
        users,
        name: 'Group',
        icon: '/assets/group-icon.png',
        lastActiveAt: Date.now(),
        type: 'group',
    };

    await db.query(
        `
            INSERT INTO channels (id, users, name, icon, last_active_at, type)
            VALUES ($1, $2, $3, $4, $5, $6);
        `,
        Object.values(channel)
    );

    sendResponse(res, 200, { id: channelID });

    // Send Message in WS
    for (const userID of users) {
        serverUtils.sendWSMessageToUser(userID, {
            op: WebSocketOP.CHANNEL_CREATE,
            d: channel,
        });
    }
});

router.get('/channels/:channelID', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { channelID } = req.params;

    const channel = (
        await db.query(
            `
                SELECT
                    *,
                    last_active_at AS "lastActiveAt"
                FROM channels
                WHERE id = $1;
            `,
            [channelID]
        )
    ).rows[0];

    if (!channel) return sendResponse(res, 404);

    const users = (
        await db.query(
            `
                SELECT id, username, avatar
                FROM users
                WHERE id = ANY($1);
            `,
            [channel.users]
        )
    ).rows;

    // Set channel's name and icon to the other user's username and avatar if it's a DM
    if (channel.type === 'dm') {
        const otherUser = users.find((user) => user.id !== req.session.user.id && channel.users.includes(user.id));

        channel.name = otherUser.username;
        channel.icon = otherUser.avatar;
    }

    // Map user IDs to usernames and avatars
    channel.users = channel.users.map((userID: string) => users.find((user) => user.id === userID));

    sendResponse(res, 200, channel);

    // Ack Messages
    await db.query(
        `
            UPDATE messages
            SET unread_users = array_remove(unread_users, $1)
            WHERE channel_id = $2;
        `,
        [req.session.user.id, channelID]
    );
});

router.delete('/channels/:channelID/members/:memberID', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { channelID, memberID } = req.params;

    const channel = (
        await db.query(
            `
                SELECT *
                FROM channels
                WHERE id = $1;
            `,
            [channelID]
        )
    ).rows[0];

    if (!channel || !channel.users.includes(memberID) || channel.type === 'dm') return sendResponse(res, 404);

    if (channel.users.length === 1) {
        await db.query(
            `
                DELETE FROM channels
                WHERE id = $1;
            `,
            [channelID]
        );

        sendResponse(res, 200);

        // Send Message in WS
        for (const userID of channel.users) {
            serverUtils.sendWSMessageToUser(userID, {
                op: WebSocketOP.CHANNEL_MEMBER_REMOVE,
                d: { id: channelID, memberID: req.session.user.id },
            });
        }
    } else {
        await db.query(
            `
                UPDATE channels
                SET users = array_remove(users, $1)
                WHERE id = $2;
            `,
            [memberID, channelID]
        );

        const username = (
            await db.query(
                `
                    SELECT username
                    FROM users
                    WHERE id = $1;
                `,
                [memberID]
            )
        ).rows[0].username;

        const message = {
            id: uid.getUniqueID().toString(),
            channelID,
            authorID: '1',
            content: `${username} left the group.`,
            sentAt: Date.now(),
            unreadUsers: channel.users.filter((userID: string) => userID !== memberID),
        };

        await db.query(
            `
                INSERT INTO messages (id, channel_id, author_id, content, sent_at, unread_users)
                VALUES ($1, $2, $3, $4, $5, $6);
            `,
            Object.values(message)
        );

        sendResponse(res, 200);

        // Send Message in WS
        for (const userID of channel.users) {
            serverUtils.sendWSMessageToUser(userID, {
                op: WebSocketOP.CHANNEL_MEMBER_REMOVE,
                d: { id: channelID, memberID },
            });

            serverUtils.sendWSMessageToUser(userID, {
                op: WebSocketOP.MESSAGE_CREATE,
                d: message,
            });
        }
    }
});
router.get('/channels/:channelID/messages', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { channelID } = req.params;
    const { content } = req.query;

    const messages = (
        await db.query(
            `
                SELECT
                    id,
                    channel_id AS "channelID",
                    author_id AS "authorID",
                    content,
                    file,
                    file_name AS "fileName",
                    sent_at AS "sentAt",
                    edited_at AS "editedAt"
                FROM messages
                WHERE channel_id = $1${content ? ' AND content LIKE $2' : ''}
                ORDER BY sent_at DESC;
            `,
            content ? [channelID, `%${content}%`] : [channelID]
        )
    ).rows;

    sendResponse(res, 200, messages);
});

router.post('/channels/:channelID/messages', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { channelID } = req.params;
    const { content, file, fileName } = req.body;

    if (!content && !file) return sendResponse(res, 400);
    if (file) {
        if (!fileName) return sendResponse(res, 400);

        const base64Length = file.length - (file.indexOf(',') + 1);
        const padding = file.charAt(file.length - 2) === '=' ? 2 : file.charAt(file.length - 1) === '=' ? 1 : 0;
        const fileSize = base64Length * 0.75 - padding;

        if (fileSize / 1024 / 1024 > 100) return sendResponse(res, 400);
    }

    const usersInThisChannel = (
        await db.query(
            `
                SELECT users
                FROM channels
                WHERE id = $1;
            `,
            [channelID]
        )
    ).rows[0].users as string[];

    const message = {
        id: uid.getUniqueID().toString(),
        channelID,
        authorID: req.session.user.id,
        content: content.trim(),
        file,
        fileName,
        sentAt: Date.now(),
    };

    await db.query(
        `
            INSERT INTO messages (id, channel_id, author_id, content, file, file_name, sent_at, unread_users)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
        `,
        [...Object.values(message), usersInThisChannel.filter((userID) => userID !== req.session.user.id)]
    );

    await db.query(
        `
            UPDATE channels
            SET last_active_at = $1
            WHERE id = $2;
        `,
        [message.sentAt, channelID]
    );

    sendResponse(res, 200);

    // Send Message in WS
    for (const userID of usersInThisChannel) serverUtils.sendWSMessageToUser(userID, { op: WebSocketOP.MESSAGE_CREATE, d: message });
});

router.put('/channels/:channelID/messages/:messageID', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { messageID } = req.params;
    if (!req.body.content || typeof req.body.content !== 'string') return sendResponse(res, 400);

    const message = (
        await db.query(
            `
                SELECT *
                FROM messages
                WHERE id = $1;
            `,
            [messageID]
        )
    ).rows[0];

    if (!message) return sendResponse(res, 404);

    if (message.author_id !== req.session.user.id) return sendResponse(res, 403);

    await db.query(
        `
            UPDATE messages
            SET content = $1, edited_at = $2
            WHERE id = $3;
        `,
        [req.body.content, Date.now(), messageID]
    );

    sendResponse(res, 200);

    // Send Message in WS
    for (const userID of message.users) serverUtils.sendWSMessageToUser(userID, { op: WebSocketOP.MESSAGE_UPDATE, d: { id: messageID, content: req.body.content } });
});

router.delete('/channels/:channelID/messages/:messageID', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { messageID } = req.params;
    if (typeof messageID !== 'string') return sendResponse(res, 400);

    const message = (
        await db.query(
            `
                SELECT *
                FROM messages
                WHERE id = $1;
            `,
            [messageID]
        )
    ).rows[0];

    if (!message) return sendResponse(res, 404);
    if (message.author_id !== req.session.user.id) return sendResponse(res, 403);

    await db.query(
        `
            DELETE FROM messages
            WHERE id = $1;
        `,
        [messageID]
    );

    sendResponse(res, 200);

    // Send Message in WS
    const usersInThisChannel = (
        await db.query(
            `
                SELECT users
                FROM channels
                WHERE id = $1;
            `,
            [message.channel_id]
        )
    ).rows[0].users as string[];

    for (const userID of usersInThisChannel) serverUtils.sendWSMessageToUser(userID, { op: WebSocketOP.MESSAGE_DELETE, d: { id: messageID } });
});

router.get('/friends', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const friendsID =
        (
            await db.query(
                `
                    SELECT
                        friends,
                        friend_requests AS "friendRequests"
                    FROM users
                    WHERE id = $1;
                `,
                [req.session.user.id]
            )
        ).rows[0] || {};

    const friendsUserData = (
        await db.query(
            `
                SELECT
                    id,
                    username,
                    avatar
                FROM users
                WHERE id = ANY($1);
            `,
            [(friendsID.friends || []).concat(friendsID.friendRequests || [])]
        )
    ).rows;

    const pendingFriendRequests = (
        await db.query(
            `
                SELECT
                    id,
                    username,
                    avatar
                FROM users
                WHERE friend_requests @> ARRAY[$1];
            `,
            [req.session.user.id]
        )
    ).rows;

    const friendsData = {
        friends: friendsID.friends?.map((friendID: string) => friendsUserData.find((friend) => friend.id === friendID)) || [],
        friendRequests: friendsID.friendRequests?.map((friendID: string) => friendsUserData.find((friendReq) => friendReq.id === friendID)) || [],
        pendingFriendRequests: pendingFriendRequests || [],
    };

    sendResponse(res, 200, friendsData);
});

router.patch('/friends/:username', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { username } = req.params;
    if (!username) return sendResponse(res, 400);

    const op = req.body.op;

    const userData =
        (
            await db.query(
                `
                SELECT
                    id,
                    avatar
                FROM users
                WHERE username = $1;
            `,
                [username]
            )
        ).rows[0] || {};

    const userID = userData.id;

    if (!userID || userID === req.session.user.id) return sendResponse(res, 400);

    if (op === 'add') {
        const friendsInfo =
            (
                await db.query(
                    `
                        SELECT
                            friends,
                            friend_requests AS "friendRequests",
                            avatar
                        FROM users
                        WHERE id = $1;
                    `,
                    [userID]
                )
            ).rows[0] || {};

        if (friendsInfo.friends?.includes(req.session.user.id) || friendsInfo.friendRequests?.includes(req.session.user.id)) return sendResponse(res, 403);

        await db.query(
            `
                UPDATE users
                SET friend_requests = array_append(friend_requests, $1)
                WHERE id = $2;
            `,
            [req.session.user.id, userID]
        );

        sendResponse(res, 200);

        const senderAvatar = (
            await db.query(
                `
                    SELECT avatar
                    FROM users
                    WHERE id = $1;
                `,
                [req.session.user.id]
            )
        ).rows[0].avatar;

        // Send Message in WS
        for (const id of [userID, req.session.user.id])
            serverUtils.sendWSMessageToUser(id, {
                op: WebSocketOP.FRIEND_REQ_SEND,
                d: {
                    sender: {
                        id: req.session.user.id,
                        username: req.session.user.username,
                        avatar: senderAvatar,
                    },
                    receiver: {
                        id: userID,
                        username: userData.username,
                        avatar: userData.avatar,
                    },
                },
            });
    } else if (op === 'remove') {
        await db.query(
            `
                UPDATE users
                SET
                    friends = array_remove(friends, $1),
                    friend_requests = array_remove(friend_requests, $1)
                WHERE id = $2;
            `,
            [req.session.user.id, userID]
        );

        await db.query(
            `
                UPDATE users
                SET
                    friends = array_remove(friends, $1),
                    friend_requests = array_remove(friend_requests, $1)
                WHERE id = $2;
            `,
            [userID, req.session.user.id]
        );

        sendResponse(res, 200);

        // Send Message in WS
        for (const id of [userID, req.session.user.id])
            serverUtils.sendWSMessageToUser(id, {
                op: WebSocketOP.FRIEND_REQ_DELETE,
                d: {
                    sender: { id: req.session.user.id },
                    receiver: { id: userID },
                },
            });
    } else if (op === 'accept') {
        const friendsInfo =
            (
                await db.query(
                    `
                        SELECT
                            friends,
                            avatar
                        FROM users
                        WHERE id = $1;
                    `,
                    [req.session.user.id]
                )
            ).rows[0] || {};

        if (friendsInfo.friends?.includes(userID)) return sendResponse(res, 403);

        await db.query(
            `
                UPDATE users
                SET
                    friends = array_append(friends, $1),
                    friend_requests = array_remove(friend_requests, $1)
                WHERE id = $2;
            `,
            [userID, req.session.user.id]
        );

        await db.query(
            `
                UPDATE users
                SET
                    friends = array_append(friends, $1),
                    friend_requests = array_remove(friend_requests, $1)
                WHERE id = $2;
            `,
            [req.session.user.id, userID]
        );

        const channel = (
            await db.query(
                `
                    SELECT id
                    FROM channels
                    WHERE $1 = ANY(users) AND $2 = ANY(users);
                `,
                [req.session.user.id, userID]
            )
        ).rows[0];

        if (!channel) {
            const channelID = uid.getUniqueID().toString();
            const lastActiveAt = Date.now();

            await db.query(
                `
                    INSERT INTO channels (id, users, name, icon, last_active_at, type)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id)
                    DO NOTHING;
                `,
                [channelID, [req.session.user.id, userID], null, null, Date.now(), 'dm']
            );

            // Send Message in WS
            for (const id of [userID, req.session.user.id])
                serverUtils.sendWSMessageToUser(id, {
                    op: WebSocketOP.CHANNEL_CREATE,
                    d: {
                        id: channelID,
                        users: [req.session.user.id, userID],
                        name: id === userID ? username : req.session.user.username,
                        icon: id === userID ? userData.avatar : friendsInfo.avatar,
                        lastActiveAt,
                        type: 'dm',
                    },
                });
        }

        sendResponse(res, 200);

        // Send Message in WS
        for (const id of [userID, req.session.user.id])
            serverUtils.sendWSMessageToUser(id, {
                op: WebSocketOP.FRIEND_REQ_ACCEPT,
                d: {
                    sender: {
                        id: req.session.user.id,
                        username: req.session.user.username,
                        avatar: friendsInfo.avatar,
                    },
                    receiver: {
                        id: userID,
                        username,
                        avatar: userData.avatar,
                    },
                },
            });
    } else if (op === 'reject') {
        await db.query(
            `
                    UPDATE users
                    SET friend_requests = array_remove(friend_requests, $1)
                    WHERE id = $2;
                `,
            [userID, req.session.user.id]
        );

        sendResponse(res, 200);

        // Send Message in WS
        for (const id of [userID, req.session.user.id])
            serverUtils.sendWSMessageToUser(id, {
                op: WebSocketOP.FRIEND_REQ_REJECT,
                d: {
                    sender: { id: req.session.user.id },
                    receiver: { id: userID },
                },
            });
    }
});

router.all('/*', makeRateLimiter(60), (_req, res) => {
    sendResponse(res, 404);
});
