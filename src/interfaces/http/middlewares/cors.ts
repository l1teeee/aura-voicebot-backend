import { NextFunction, Request, RequestHandler, Response } from 'express';
import { HTTP_STATUS } from '../constants';

const ORIGIN_HEADER = 'Origin';
const VARY_HEADER = 'Vary';
const ALLOW_ORIGIN_HEADER = 'Access-Control-Allow-Origin';
const ALLOW_METHODS_HEADER = 'Access-Control-Allow-Methods';
const ALLOW_HEADERS_HEADER = 'Access-Control-Allow-Headers';
const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type';
const PREFLIGHT_METHOD = 'OPTIONS';

export const createCorsMiddleware =
  (allowedOrigin: string): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader(VARY_HEADER, ORIGIN_HEADER);

    if (req.headers.origin === allowedOrigin) {
      res.setHeader(ALLOW_ORIGIN_HEADER, allowedOrigin);
      res.setHeader(ALLOW_METHODS_HEADER, ALLOWED_METHODS);
      res.setHeader(ALLOW_HEADERS_HEADER, ALLOWED_HEADERS);
    }

    if (req.method === PREFLIGHT_METHOD) {
      res.status(HTTP_STATUS.noContent).end();
      return;
    }

    next();
  };
