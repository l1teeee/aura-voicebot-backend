import { DOMAIN_ERROR_CODES } from '../constants';
import { DomainError } from './DomainError';

export class ExternalServiceError extends DomainError {
  readonly code: string = DOMAIN_ERROR_CODES.externalService;

  readonly serviceName: string;

  readonly status: number | null;

  constructor(serviceName: string, status: number | null, message: string) {
    super(message);
    this.serviceName = serviceName;
    this.status = status;
  }
}
