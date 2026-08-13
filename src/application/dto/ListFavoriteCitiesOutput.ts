export interface FavoriteCityListItem {
  readonly id: string;
  readonly city: string;
  readonly createdAt: string;
}

export interface ListFavoriteCitiesOutput {
  readonly cities: readonly FavoriteCityListItem[];
}
