import { Router } from 'express';
import rateLimit from 'express-rate-limit';

export const router = Router();

const makeRateLimiter = (allowedRequestsPerMinute: number) =>
    rateLimit({
        windowMs: 60 * 1000,
        max: allowedRequestsPerMinute,
        handler: (_req, res) => res.status(429).send(),
    });

router.get('/', makeRateLimiter(60), (_req, res) => {
    res.status(200).send();
});

router.all('/*', makeRateLimiter(60), (_req, res) => {
    res.status(404).send();
});
