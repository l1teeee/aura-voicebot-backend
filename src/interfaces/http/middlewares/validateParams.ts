import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodIssue, ZodTypeAny } from 'zod';
import { ValidationError } from '../../../domain/errors/ValidationError';

const ISSUE_SEPARATOR = '; ';
const FIELD_PATH_SEPARATOR = '.';

const describeIssue = (issue: ZodIssue): string =>
  issue.path.length === 0
    ? issue.message
    : `${issue.path.join(FIELD_PATH_SEPARATOR)}: ${issue.message}`;

export const validateParams =
  (schema: ZodTypeAny): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const message = result.error.issues.map(describeIssue).join(ISSUE_SEPARATOR);
      next(new ValidationError(message));
      return;
    }

    next();
  };
