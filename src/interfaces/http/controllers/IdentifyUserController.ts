import { NextFunction, Request, RequestHandler, Response } from 'express';
import { IdentifyUserUseCase } from '../../../application/use-cases/IdentifyUserUseCase';
import { HTTP_STATUS } from '../constants';
import { IdentifyUserRequest } from '../schemas/identifyUserRequestSchema';

export class IdentifyUserController {
  constructor(private readonly identifyUser: IdentifyUserUseCase) {}

  readonly handle: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { name } = req.body as IdentifyUserRequest;
      const output = await this.identifyUser.execute({ name });

      res.status(HTTP_STATUS.ok).json(output);
    } catch (error) {
      next(error);
    }
  };
}
