import { db } from '..';

db.query(`
    CREATE TABLE IF NOT EXISTS messages (
        id              text    PRIMARY KEY,
        channel_id      text,
        author_id       text,
        content         text,
        file            text,
        file_name       text,
        sent_at         bigint    NOT NULL,
        edited_at       bigint,
        unread_users    text[]  NOT NULL
    );
`);
