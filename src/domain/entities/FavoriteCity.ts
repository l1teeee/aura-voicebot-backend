export class FavoriteCity {
  private constructor(
    private readonly identifier: string,
    private readonly ownerId: string,
    private readonly displayName: string,
    private readonly temperatureValue: number,
    private readonly unitsValue: string,
    private readonly savedAt: Date
  ) {}

  static fromPersistence(
    id: string,
    userId: string,
    city: string,
    temperature: number,
    units: string,
    createdAt: Date
  ): FavoriteCity {
    return new FavoriteCity(id, userId, city, temperature, units, new Date(createdAt.getTime()));
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

  get temperature(): number {
    return this.temperatureValue;
  }

  get units(): string {
    return this.unitsValue;
  }

  get createdAt(): Date {
    return new Date(this.savedAt.getTime());
  }
}
