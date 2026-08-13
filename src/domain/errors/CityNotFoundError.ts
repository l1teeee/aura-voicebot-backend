import { DOMAIN_ERROR_CODES } from '../constants';
import { DomainError } from './DomainError';

export class CityNotFoundError extends DomainError {
  readonly code: string = DOMAIN_ERROR_CODES.cityNotFound;

  readonly city: string;

  constructor(city: string) {
    super(`No encuentro la ciudad ${city}. Revisa el nombre y vuelve a intentarlo.`);
    this.city = city;
  }
}
