import { UUID_V4_PATTERN } from '../../domain/constants';
import { ValidationError } from '../../domain/errors/ValidationError';
import type { FavoriteCityRepository } from '../../domain/ports/FavoriteCityRepository';
import { ListFavoriteCitiesInput } from '../dto/ListFavoriteCitiesInput';
import { ListFavoriteCitiesOutput } from '../dto/ListFavoriteCitiesOutput';

const INVALID_USER_ID_MESSAGE = 'El identificador del usuario debe ser un UUID v4 válido.';

export class ListFavoriteCitiesUseCase {
  constructor(private readonly favoriteCityRepository: FavoriteCityRepository) {}

  async execute(input: ListFavoriteCitiesInput): Promise<ListFavoriteCitiesOutput> {
    const userId = input.userId.trim().toLowerCase();

    if (!UUID_V4_PATTERN.test(userId)) {
      throw new ValidationError(INVALID_USER_ID_MESSAGE);
    }

    const favoriteCities = await this.favoriteCityRepository.list(userId);

    return {
      cities: favoriteCities.map((favoriteCity) => ({
        id: favoriteCity.id,
        city: favoriteCity.city,
        temperature: favoriteCity.temperature,
        units: favoriteCity.units,
        createdAt: favoriteCity.createdAt.toISOString()
      }))
    };
  }
}
