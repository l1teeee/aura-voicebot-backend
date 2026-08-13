import { Router } from 'express';
import { IdentifyUserController } from '../controllers/IdentifyUserController';
import { validateBody } from '../middlewares/validateBody';
import { identifyUserRequestSchema } from '../schemas/identifyUserRequestSchema';

const IDENTIFY_ROUTE_PATH = '/';

export const createIdentifyRouter = (controller: IdentifyUserController): Router => {
  const router = Router();

  router.post(IDENTIFY_ROUTE_PATH, validateBody(identifyUserRequestSchema), controller.handle);

  return router;
};
