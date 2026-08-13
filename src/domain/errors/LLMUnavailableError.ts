import { DOMAIN_ERROR_CODES } from '../constants';
import { DomainError } from './DomainError';

export class LLMUnavailableError extends DomainError {
  readonly code: string = DOMAIN_ERROR_CODES.llmUnavailable;

  constructor(message: string) {
    super(message);
  }
}
