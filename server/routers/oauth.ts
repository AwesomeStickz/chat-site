import { Router } from 'express';
import { google } from 'googleapis';
export const router = Router();

const googleOauth2Client = new google.auth.OAuth2(process.env.GOOGLE_OAUTH_CLIENT_ID, process.env.GOOGLE_OAUTH_CLIENT_SECRET, `${process.env.BASE_URL}/oauth/google/callback`);

const googleAuthURL = googleOauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    include_granted_scopes: true,
});

router.get('/oauth/google', (_req, res) => {
    res.redirect(googleAuthURL);
});
