import type { Pool, QueryResultRow } from 'pg';
import { FavoriteCity } from '../../domain/entities/FavoriteCity';
import { FavoriteCityAlreadyExistsError } from '../../domain/errors/FavoriteCityAlreadyExistsError';
import type { FavoriteCityRepository } from '../../domain/ports/FavoriteCityRepository';
import { normalizeKey } from '../../domain/utils/normalizeKey';

const ADD_FAVORITE_CITY_QUERY = `
  INSERT INTO favorite_cities (user_id, city, city_key, temperature, units)
  VALUES ($1, $2, $3, $4, $5)
  ON CONFLICT (user_id, city_key) DO NOTHING
  RETURNING id, user_id, city, temperature, units, created_at
`;

const LIST_FAVORITE_CITIES_QUERY = `
  SELECT id, user_id, city, temperature, units, created_at
  FROM favorite_cities
  WHERE user_id = $1
  ORDER BY created_at DESC
`;

const REMOVE_FAVORITE_CITY_QUERY = `
  DELETE FROM favorite_cities
  WHERE id = $1
`;

interface FavoriteCityRow extends QueryResultRow {
  readonly id: string;
  readonly user_id: string;
  readonly city: string;
  readonly temperature: number;
  readonly units: string;
  readonly created_at: Date | string;
}

const toDate = (value: Date | string): Date =>
  value instanceof Date ? new Date(value.getTime()) : new Date(value);

const mapFavoriteCity = (row: FavoriteCityRow): FavoriteCity =>
  FavoriteCity.fromPersistence(
    row.id,
    row.user_id,
    row.city,
    row.temperature,
    row.units,
    toDate(row.created_at)
  );

export class PostgresFavoriteCityRepository implements FavoriteCityRepository {
  constructor(private readonly pool: Pool) {}

  async add(
    userId: string,
    city: string,
    temperature: number,
    units: string
  ): Promise<FavoriteCity> {
    const result = await this.pool.query<FavoriteCityRow>(ADD_FAVORITE_CITY_QUERY, [
      userId,
      city,
      normalizeKey(city),
      temperature,
      units
    ]);
    const row = result.rows[0];

    if (row === undefined) {
      throw new FavoriteCityAlreadyExistsError(city);
    }

    return mapFavoriteCity(row);
  }

  async list(userId: string): Promise<readonly FavoriteCity[]> {
    const result = await this.pool.query<FavoriteCityRow>(LIST_FAVORITE_CITIES_QUERY, [userId]);

    return result.rows.map(mapFavoriteCity);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query(REMOVE_FAVORITE_CITY_QUERY, [id]);

    return result.rowCount !== null && result.rowCount > 0;
  }
}
