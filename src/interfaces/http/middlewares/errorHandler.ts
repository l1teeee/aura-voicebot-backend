import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { DOMAIN_ERROR_CODES } from '../../../domain/constants';
import { DomainError } from '../../../domain/errors/DomainError';
import {
  CLIENT_ERROR_MAX_STATUS,
  CLIENT_ERROR_MIN_STATUS,
  HTTP_STATUS,
  INTERNAL_ERROR_CODE,
  INTERNAL_ERROR_MESSAGE,
  MALFORMED_BODY_MESSAGE
} from '../constants';

const UNIDENTIFIED_ERROR_DESCRIPTION = 'Error no identificado.';

const STATUS_BY_DOMAIN_ERROR_CODE = new Map<string, number>([
  [DOMAIN_ERROR_CODES.validation, HTTP_STATUS.badRequest],
  [DOMAIN_ERROR_CODES.cityNotFound, HTTP_STATUS.badRequest],
  [DOMAIN_ERROR_CODES.favoriteCityAlreadyExists, HTTP_STATUS.conflict],
  [DOMAIN_ERROR_CODES.favoriteCityNotFound, HTTP_STATUS.notFound],
  [DOMAIN_ERROR_CODES.rateLimitExceeded, HTTP_STATUS.tooManyRequests],
  [DOMAIN_ERROR_CODES.llmUnavailable, HTTP_STATUS.serviceUnavailable],
  [DOMAIN_ERROR_CODES.externalService, HTTP_STATUS.serviceUnavailable]
]);

const resolveStatus = (code: string): number =>
  STATUS_BY_DOMAIN_ERROR_CODE.get(code) ?? HTTP_STATUS.internalServerError;

const describeUnexpectedError = (error: unknown): string =>
  error instanceof Error ? error.message : UNIDENTIFIED_ERROR_DESCRIPTION;

const readDeclaredStatus = (error: Error): number | null => {
  const declaredStatus: unknown =
    (error as { status?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode;
  return typeof declaredStatus === 'number' ? declaredStatus : null;
};

const isMalformedRequestError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const declaredStatus = readDeclaredStatus(error);
  return (
    declaredStatus !== null &&
    declaredStatus >= CLIENT_ERROR_MIN_STATUS &&
    declaredStatus <= CLIENT_ERROR_MAX_STATUS
  );
};

const logError = (code: string, message: string): void => {
  console.error(`[${code}] ${message}`);
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof DomainError) {
    logError(error.code, error.message);
    res
      .status(resolveStatus(error.code))
      .json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (isMalformedRequestError(error)) {
    logError(DOMAIN_ERROR_CODES.validation, describeUnexpectedError(error));
    res
      .status(HTTP_STATUS.badRequest)
      .json({ error: { code: DOMAIN_ERROR_CODES.validation, message: MALFORMED_BODY_MESSAGE } });
    return;
  }

  logError(INTERNAL_ERROR_CODE, describeUnexpectedError(error));
  res
    .status(HTTP_STATUS.internalServerError)
    .json({ error: { code: INTERNAL_ERROR_CODE, message: INTERNAL_ERROR_MESSAGE } });
};
