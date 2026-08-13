import { DOMAIN_ERROR_CODES } from '../constants';
import { DomainError } from './DomainError';

export class FavoriteCityAlreadyExistsError extends DomainError {
  readonly code: string = DOMAIN_ERROR_CODES.favoriteCityAlreadyExists;

  constructor(city: string) {
    super(`${city} ya está guardada como ciudad favorita.`);
  }
}
