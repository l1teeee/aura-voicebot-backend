export type TemperatureUnits = 'metric' | 'imperial';

export interface WeatherSnapshot {
  readonly city: string;
  readonly country: string;
  readonly temperature: number;
  readonly feelsLike: number;
  readonly description: string;
  readonly humidity: number;
  readonly units: TemperatureUnits;
}

export interface WeatherProvider {
  getCurrentWeather(city: string, units: TemperatureUnits): Promise<WeatherSnapshot>;
}
