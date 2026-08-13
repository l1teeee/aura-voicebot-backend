import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ProcessUserMessageUseCase } from '../../../application/use-cases/ProcessUserMessageUseCase';
import { HTTP_STATUS } from '../constants';
import { ChatRequest } from '../schemas/chatRequestSchema';

export class ChatController {
  constructor(private readonly processUserMessage: ProcessUserMessageUseCase) {}

  readonly handle: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { message, sessionId, userId, image } = req.body as ChatRequest;
      const output = await this.processUserMessage.execute({ sessionId, message, userId, image });

      res.status(HTTP_STATUS.ok).json({
        reply: output.reply,
        sessionId: output.sessionId,
        ...(output.action === undefined ? {} : { action: output.action })
      });
    } catch (error) {
      next(error);
    }
  };
}
