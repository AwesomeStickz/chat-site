import ExpressSession = require('express-session');

declare module 'express-session' {
    interface Session {
        user: Record<string, any>;
    }
}
