import { Router } from 'express';
import { SpeechController } from '../controllers/SpeechController';
import { validateBody } from '../middlewares/validateBody';
import { speechRequestSchema } from '../schemas/speechRequestSchema';

const SPEECH_ROUTE_PATH = '/';

export const createSpeechRouter = (controller: SpeechController): Router => {
  const router = Router();

  router.post(SPEECH_ROUTE_PATH, validateBody(speechRequestSchema), controller.handle);

  return router;
};
