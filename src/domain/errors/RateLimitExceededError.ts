import { DOMAIN_ERROR_CODES } from '../constants';
import { DomainError } from './DomainError';

export class RateLimitExceededError extends DomainError {
  readonly code: string = DOMAIN_ERROR_CODES.rateLimitExceeded;

  constructor(message: string) {
    super(message);
  }
}
