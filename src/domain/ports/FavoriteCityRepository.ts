import type { FavoriteCity } from '../entities/FavoriteCity';

export interface FavoriteCityRepository {
  add(userId: string, city: string, temperature: number, units: string): Promise<FavoriteCity>;
  list(userId: string): Promise<readonly FavoriteCity[]>;
  remove(id: string): Promise<boolean>;
}
