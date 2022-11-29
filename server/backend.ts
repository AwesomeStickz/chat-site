import bodyParser from 'body-parser';
import pgSession from 'connect-pg-simple';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { Snowflake } from 'nodejs-snowflake';
import path from 'path';
import { constants } from '../src/utils/constants';
import { db } from './database';
import { routers } from './routers';
import './websocket';

export const uid = new Snowflake({ custom_epoch: 0 });

const app = express();

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

app.use(express.static(path.join(__dirname, '../../', 'build')));

app.get('/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../', 'build', 'index.html'));
});

app.listen(3333);

process.on('unhandledRejection', (error) => {
    console.error('Uncaught Promise Error: ', error);
});

console.log('Backend Started and is Running!');
