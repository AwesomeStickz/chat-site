import { Router } from 'express';
import { google } from 'googleapis';
import superagent from 'superagent';
import { constants } from '../../src/utils/constants';
import { uid } from '../backend';
import { db } from '../database';

export const router = Router();

const googleOauth2Client = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET, `${constants.backendBaseURL}/oauth/google/callback`);

const googleAuthURL = googleOauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    include_granted_scopes: true,
});

router.get('/google', (_req, res) => {
    res.redirect(googleAuthURL);
});

router.get('/google/callback', async (req, res) => {
    try {
        const tokenData = (await googleOauth2Client.getToken(req.query.code as string)).tokens;
        const userDataFromGoogleAPI = (await superagent.get(`https://www.googleapis.com/oauth2/v3/userinfo`).set('Authorization', `Bearer ${tokenData.access_token}`)).body;

        const userDataFromDB = (
            await db.query(`
                SELECT
                    id,
                    email,
                    username
                FROM users
                WHERE email = '${userDataFromGoogleAPI.email}';
            `)
        ).rows[0];

        if (userDataFromDB?.username) {
            req.session.user = userDataFromDB;

            res.cookie('loggedIn', 'true', { maxAge: 7 * 24 * 60 * 60 * 1000 });
            res.cookie('username', userDataFromDB.username);
            res.cookie('id', userDataFromDB.id);

            res.redirect(`${constants.frontendBaseURL}/app`);
        } else {
            const userID = uid.getUniqueID().toString();

            await db.query(
                `
                    INSERT INTO users (id, email, avatar)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (email)
                    DO UPDATE SET
                        id = $1,
                        email = $2,
                        avatar = $3;
                `,
                [userID, userDataFromGoogleAPI.email, userDataFromGoogleAPI.picture]
            );

            req.session.user = { id: userID, email: userDataFromGoogleAPI.email, username: null };

            res.cookie('username', userDataFromGoogleAPI.name);

            res.redirect(`${constants.frontendBaseURL}/register`);
        }
    } catch (err) {
        console.error(err);

        res.status(500).redirect(`${constants.frontendBaseURL}/404`);
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);

        res.clearCookie('loggedIn');
        res.clearCookie('username');

        res.redirect(`${constants.frontendBaseURL}/login`);
    });
});
