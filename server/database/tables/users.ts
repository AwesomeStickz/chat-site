import { db } from '..';

db.query(`
    CREATE TABLE IF NOT EXISTS users (
        id              text    PRIMARY KEY,
        avatar          text,
        email           text    NOT NULL,
        username        text,
        friends         text[],
        friend_requests text[],

        UNIQUE(email)
    );
`);
