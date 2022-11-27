import { NextFunction, Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { constants } from '../../src/utils/constants';
import { uid } from '../backend';
import { db } from '../database';

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

    sendResponse(res, 200);
});

router.get('/channels', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const channels = (
        await db.query(
            `
                SELECT *
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

router.get('/channels/:channelID', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { channelID } = req.params;

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
});

router.get('/channels/:channelID/messages', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { channelID } = req.params;

    const messages = (
        await db.query(
            `
                SELECT
                    id,
                    channel_id AS "channelID",
                    author_id AS "authorID",
                    content,
                    sent_at AS "sentAt",
                    edited_at AS "editedAt"
                FROM messages
                WHERE channel_id = $1
                ORDER BY sent_at DESC
                LIMIT 100;
            `,
            [channelID]
        )
    ).rows;

    sendResponse(res, 200, messages);
});

router.post('/channels/:channelID/messages', makeRateLimiter(60), handleAuthorizationCheck, async (req, res) => {
    const { channelID } = req.params;
    const { content } = req.body;

    if (!content) return sendResponse(res, 400);

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

    await db.query(
        `
            INSERT INTO messages (id, channel_id, author_id, content, sent_at, unread_users)
            VALUES ($1, $2, $3, $4, $5, $6);
        `,
        [uid.getUniqueID().toString(), channelID, req.session.user.id, content, Date.now(), [usersInThisChannel.filter((userID) => userID !== req.session.user.id)]]
    );

    sendResponse(res, 200);
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

    const userID = (
        await db.query(
            `
                SELECT id
                FROM users
                WHERE username = $1;
            `,
            [username]
        )
    ).rows[0]?.id;

    if (!userID || userID === req.session.user.id) return sendResponse(res, 400);

    if (op === 'add') {
        const friends =
            (
                await db.query(
                    `
                        SELECT friends
                        FROM users
                        WHERE id = $1;
                    `,
                    [req.session.user.id]
                )
            ).rows[0]?.friends || [];

        if (friends.includes(userID)) return sendResponse(res, 403);

        await db.query(
            `
                UPDATE users
                SET friend_requests = array_append(friend_requests, $1)
                WHERE id = $2;
            `,
            [req.session.user.id, userID]
        );

        sendResponse(res, 200);
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
    } else if (op === 'accept') {
        const friends =
            (
                await db.query(
                    `
                        SELECT friends
                        FROM users
                        WHERE id = $1;
                    `,
                    [req.session.user.id]
                )
            ).rows[0]?.friends || [];

        if (friends.includes(userID)) return sendResponse(res, 403);

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

            await db.query(
                `
                    INSERT INTO channels (id, users, name, icon, type)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id)
                    DO NOTHING;
                `,
                [channelID, [req.session.user.id, userID], null, null, 'dm']
            );
        }

        sendResponse(res, 200);
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
    }
});

router.all('/*', makeRateLimiter(60), (_req, res) => {
    sendResponse(res, 404);
});
