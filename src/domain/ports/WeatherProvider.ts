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

export interface DailyForecast {
  readonly date: string;
  readonly label: string;
  readonly minTemperature: number;
  readonly maxTemperature: number;
  readonly description: string;
  readonly precipitationChance: number;
}

export interface WeatherForecast {
  readonly city: string;
  readonly country: string;
  readonly units: TemperatureUnits;
  readonly days: readonly DailyForecast[];
}

export interface WeatherProvider {
  getCurrentWeather(city: string, units: TemperatureUnits): Promise<WeatherSnapshot>;
  getForecast(city: string, units: TemperatureUnits): Promise<WeatherForecast>;
}
