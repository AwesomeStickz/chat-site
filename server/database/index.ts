import fs from 'fs';
import { Pool } from 'pg';

const pool = new Pool();

pool.connect()
    .then(() => console.log('[Database]\tConnection has been established!'))
    .catch((err) => console.error('Problem with connecting to database:', err));

fs.readdir(`${__dirname}/tables/`, (err, files) => {
    if (err) return console.error(err);
    files.forEach((file) => require(`./tables/${file}`));
});

export const db = pool;
