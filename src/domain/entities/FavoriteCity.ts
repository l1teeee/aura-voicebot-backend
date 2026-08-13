export class FavoriteCity {
  private constructor(
    private readonly identifier: string,
    private readonly ownerId: string,
    private readonly displayName: string,
    private readonly savedAt: Date
  ) {}

  static fromPersistence(
    id: string,
    userId: string,
    city: string,
    createdAt: Date
  ): FavoriteCity {
    return new FavoriteCity(id, userId, city, new Date(createdAt.getTime()));
  }

  get id(): string {
    return this.identifier;
  }

  get userId(): string {
    return this.ownerId;
  }

  get city(): string {
    return this.displayName;
  }

  get createdAt(): Date {
    return new Date(this.savedAt.getTime());
  }
}
