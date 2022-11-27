import { db } from '..';

db.query(`
    CREATE TABLE IF NOT EXISTS channels (
        id          text    PRIMARY KEY,
        users       text[]  NOT NULL,
        name        text,
        icon        text,
        type        text    NOT NULL
    );
`);
