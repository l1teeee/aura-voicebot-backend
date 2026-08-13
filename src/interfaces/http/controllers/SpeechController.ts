import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { SynthesizeSpeechUseCase } from '../../../application/use-cases/SynthesizeSpeechUseCase';
import { HTTP_STATUS } from '../constants';
import { SpeechRequest } from '../schemas/speechRequestSchema';

const CONTENT_TYPE_HEADER = 'Content-Type';
const CACHE_CONTROL_HEADER = 'Cache-Control';
const NO_STORE_DIRECTIVE = 'no-store';

export class SpeechController {
  constructor(private readonly synthesizeSpeech: SynthesizeSpeechUseCase) {}

  readonly handle: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { text } = req.body as SpeechRequest;
      const speech = await this.synthesizeSpeech.execute({ text });

      res.status(HTTP_STATUS.ok);
      res.setHeader(CONTENT_TYPE_HEADER, speech.contentType);
      res.setHeader(CACHE_CONTROL_HEADER, NO_STORE_DIRECTIVE);

      await pipeline(Readable.from(speech.audio), res);
    } catch (error) {
      next(error);
    }
  };
}
