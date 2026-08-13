import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { validateBody } from '../middlewares/validateBody';
import { chatRequestSchema } from '../schemas/chatRequestSchema';

const CHAT_ROUTE_PATH = '/';

export const createChatRouter = (controller: ChatController): Router => {
  const router = Router();

  router.post(CHAT_ROUTE_PATH, validateBody(chatRequestSchema), controller.handle);

  return router;
};
