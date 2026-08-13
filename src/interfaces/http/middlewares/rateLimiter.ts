import { NextFunction, Request, RequestHandler, Response } from 'express';
import { RateLimitExceededError } from '../../../domain/errors/RateLimitExceededError';
import {
  RATE_LIMIT_CLEANUP_INTERVAL_MS,
  RATE_LIMIT_EXCEEDED_MESSAGE,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS
} from '../constants';

const UNKNOWN_CLIENT_KEY = 'unknown-client';
const SINGLE_REQUEST = 1;

interface ClientWindow {
  count: number;
  startedAt: number;
}

export interface RateLimiter {
  readonly middleware: RequestHandler;
  readonly stop: () => void;
}

export const createRateLimiter = (
  maxRequests: number = RATE_LIMIT_MAX_REQUESTS
): RateLimiter => {
  const windowsByClient = new Map<string, ClientWindow>();

  const hasExpired = (clientWindow: ClientWindow, now: number): boolean =>
    now - clientWindow.startedAt >= RATE_LIMIT_WINDOW_MS;

  const purgeExpiredWindows = (): void => {
    const now = Date.now();
    for (const [clientKey, clientWindow] of windowsByClient) {
      if (hasExpired(clientWindow, now)) {
        windowsByClient.delete(clientKey);
      }
    }
  };

  const cleanupHandle: ReturnType<typeof setInterval> = setInterval(
    purgeExpiredWindows,
    RATE_LIMIT_CLEANUP_INTERVAL_MS
  );

  const middleware: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction
  ): void => {
    const clientKey = req.ip ?? UNKNOWN_CLIENT_KEY;
    const now = Date.now();
    const clientWindow = windowsByClient.get(clientKey);

    if (clientWindow === undefined || hasExpired(clientWindow, now)) {
      windowsByClient.set(clientKey, { count: SINGLE_REQUEST, startedAt: now });
      next();
      return;
    }

    if (clientWindow.count >= maxRequests) {
      next(new RateLimitExceededError(RATE_LIMIT_EXCEEDED_MESSAGE));
      return;
    }

    clientWindow.count += SINGLE_REQUEST;
    next();
  };

  const stop = (): void => {
    clearInterval(cleanupHandle);
    windowsByClient.clear();
  };

  return { middleware, stop };
};
