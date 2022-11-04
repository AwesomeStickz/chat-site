import { router as APIRouter } from './api';
import { router as OAuthRouter } from './oauth';

export const routers = {
    API: APIRouter,
    OAuth: OAuthRouter,
};
