import { DOMAIN_ERROR_CODES } from '../constants';
import { DomainError } from './DomainError';

export class FavoriteCityNotFoundError extends DomainError {
  readonly code: string = DOMAIN_ERROR_CODES.favoriteCityNotFound;

  constructor() {
    super('La ciudad favorita solicitada no existe.');
  }
}
