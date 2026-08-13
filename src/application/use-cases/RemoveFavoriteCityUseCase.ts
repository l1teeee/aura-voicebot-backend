import { UUID_V4_PATTERN } from '../../domain/constants';
import { FavoriteCityNotFoundError } from '../../domain/errors/FavoriteCityNotFoundError';
import { ValidationError } from '../../domain/errors/ValidationError';
import type { FavoriteCityRepository } from '../../domain/ports/FavoriteCityRepository';
import { RemoveFavoriteCityInput } from '../dto/RemoveFavoriteCityInput';
import { RemoveFavoriteCityOutput } from '../dto/RemoveFavoriteCityOutput';

const INVALID_FAVORITE_CITY_ID_MESSAGE =
  'El identificador de la ciudad favorita debe ser un UUID v4 válido.';

export class RemoveFavoriteCityUseCase {
  constructor(private readonly favoriteCityRepository: FavoriteCityRepository) {}

  async execute(input: RemoveFavoriteCityInput): Promise<RemoveFavoriteCityOutput> {
    const id = input.id.trim().toLowerCase();

    if (!UUID_V4_PATTERN.test(id)) {
      throw new ValidationError(INVALID_FAVORITE_CITY_ID_MESSAGE);
    }

    const removed = await this.favoriteCityRepository.remove(id);

    if (!removed) {
      throw new FavoriteCityNotFoundError();
    }

    return { removed: true };
  }
}
