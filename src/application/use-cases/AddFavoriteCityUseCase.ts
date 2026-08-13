import {
  MAX_FAVORITE_CITY_NAME_LENGTH,
  MIN_FAVORITE_CITY_NAME_LENGTH,
  UUID_V4_PATTERN
} from '../../domain/constants';
import { ValidationError } from '../../domain/errors/ValidationError';
import type { FavoriteCityRepository } from '../../domain/ports/FavoriteCityRepository';
import type { WeatherProvider } from '../../domain/ports/WeatherProvider';
import { DEFAULT_TEMPERATURE_UNITS } from '../constants';
import { AddFavoriteCityInput } from '../dto/AddFavoriteCityInput';
import { AddFavoriteCityOutput } from '../dto/AddFavoriteCityOutput';

const INVALID_USER_ID_MESSAGE = 'El identificador del usuario debe ser un UUID v4 válido.';
const INVALID_CITY_MESSAGE =
  `La ciudad debe tener entre ${MIN_FAVORITE_CITY_NAME_LENGTH} y ${MAX_FAVORITE_CITY_NAME_LENGTH} caracteres.`;
const CITY_WORD_PATTERN = /\S+/g;

const toTitleCase = (city: string): string =>
  city.toLocaleLowerCase('es').replace(CITY_WORD_PATTERN, (word) =>
    `${word.charAt(0).toLocaleUpperCase('es')}${word.slice(1)}`
  );

export class AddFavoriteCityUseCase {
  constructor(
    private readonly weatherProvider: WeatherProvider,
    private readonly favoriteCityRepository: FavoriteCityRepository
  ) {}

  async execute(input: AddFavoriteCityInput): Promise<AddFavoriteCityOutput> {
    const userId = input.userId.trim().toLowerCase();

    if (!UUID_V4_PATTERN.test(userId)) {
      throw new ValidationError(INVALID_USER_ID_MESSAGE);
    }

    const city = input.city.trim();

    if (
      city.length < MIN_FAVORITE_CITY_NAME_LENGTH ||
      city.length > MAX_FAVORITE_CITY_NAME_LENGTH
    ) {
      throw new ValidationError(INVALID_CITY_MESSAGE);
    }

    const snapshot = await this.weatherProvider.getCurrentWeather(city, DEFAULT_TEMPERATURE_UNITS);

    const favoriteCity = await this.favoriteCityRepository.add(
      userId,
      toTitleCase(city),
      snapshot.temperature,
      snapshot.units
    );

    return {
      id: favoriteCity.id,
      city: favoriteCity.city,
      temperature: favoriteCity.temperature,
      units: favoriteCity.units,
      createdAt: favoriteCity.createdAt.toISOString()
    };
  }
}
