export interface FavoriteCityListItem {
  readonly id: string;
  readonly city: string;
  readonly temperature: number;
  readonly units: string;
  readonly createdAt: string;
}

export interface ListFavoriteCitiesOutput {
  readonly cities: readonly FavoriteCityListItem[];
}
