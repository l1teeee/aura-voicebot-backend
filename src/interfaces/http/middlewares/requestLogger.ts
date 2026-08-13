import { NextFunction, Request, RequestHandler, Response } from 'express';
import { NANOSECONDS_PER_MILLISECOND, REQUEST_DURATION_DECIMAL_PLACES } from '../constants';

const RESPONSE_FINISH_EVENT = 'finish';

export const requestLogger: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startedAt = process.hrtime.bigint();

  res.on(RESPONSE_FINISH_EVENT, () => {
    const elapsedNanoseconds = Number(process.hrtime.bigint() - startedAt);
    const durationMs = (elapsedNanoseconds / NANOSECONDS_PER_MILLISECOND).toFixed(
      REQUEST_DURATION_DECIMAL_PLACES
    );
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
};
