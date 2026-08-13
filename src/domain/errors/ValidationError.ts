import { DOMAIN_ERROR_CODES } from '../constants';
import { DomainError } from './DomainError';

export class ValidationError extends DomainError {
  readonly code: string = DOMAIN_ERROR_CODES.validation;

  constructor(message: string) {
    super(message);
  }
}
