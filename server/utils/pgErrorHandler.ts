import { Pool } from 'pg';

const poolQuery = Pool.prototype.query;

// @ts-expect-error
Pool.prototype.query = async function query(...args: Parameters<typeof poolQuery>) {
    // If explicitly said not to error
    if (args[2]) {
        args.pop();

        return await poolQuery.apply(this, args);
    } else {
        try {
            return await poolQuery.apply(this, args);
        } catch (e) {
            const error = new Error(e);

            console.error(error, `\n${args[0]}`);
        }
    }
};
