import { CityNotFoundError } from '../../domain/errors/CityNotFoundError';
import { ExternalServiceError } from '../../domain/errors/ExternalServiceError';
import type {
  TemperatureUnits,
  WeatherProvider,
  WeatherSnapshot
} from '../../domain/ports/WeatherProvider';
import { HTTP_NOT_FOUND_STATUS } from '../constants';
import type { HttpClient, HttpResponse } from '../http/HttpClient';
import { openWeatherResponseSchema } from './openWeatherResponseSchema';
import type { OpenWeatherResponse } from './openWeatherResponseSchema';

const WEATHER_SERVICE_NAME = 'OpenWeatherMap';
const CURRENT_WEATHER_PATH = '/weather';
const RESPONSE_LANGUAGE = 'es';
const TRAILING_SLASHES_PATTERN = /\/+$/;
const UNEXPECTED_PAYLOAD_MESSAGE =
  'El servicio meteorologico devolvio una respuesta con un formato inesperado.';

const toWeatherSnapshot = (
  payload: OpenWeatherResponse,
  units: TemperatureUnits
): WeatherSnapshot => ({
  city: payload.name,
  country: payload.sys.country,
  temperature: Math.round(payload.main.temp),
  feelsLike: Math.round(payload.main.feels_like),
  description: payload.weather[0].description,
  humidity: payload.main.humidity,
  units
});

export class OpenWeatherMapProvider implements WeatherProvider {
  private readonly httpClient: HttpClient;

  private readonly apiKey: string;

  private readonly baseUrl: string;

  constructor(httpClient: HttpClient, apiKey: string, baseUrl: string) {
    this.httpClient = httpClient;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(TRAILING_SLASHES_PATTERN, '');
  }

  async getCurrentWeather(city: string, units: TemperatureUnits): Promise<WeatherSnapshot> {
    const response = await this.requestCurrentWeather(city, units);
    const parsed = openWeatherResponseSchema.safeParse(response.body);
    if (!parsed.success) {
      throw new ExternalServiceError(WEATHER_SERVICE_NAME, null, UNEXPECTED_PAYLOAD_MESSAGE);
    }
    return toWeatherSnapshot(parsed.data, units);
  }

  private async requestCurrentWeather(
    city: string,
    units: TemperatureUnits
  ): Promise<HttpResponse> {
    try {
      return await this.httpClient.request(this.buildCurrentWeatherUrl(city, units));
    } catch (error) {
      if (error instanceof ExternalServiceError && error.status === HTTP_NOT_FOUND_STATUS) {
        throw new CityNotFoundError(city);
      }
      throw error;
    }
  }

  private buildCurrentWeatherUrl(city: string, units: TemperatureUnits): string {
    const query = new URLSearchParams({
      q: city,
      units,
      appid: this.apiKey,
      lang: RESPONSE_LANGUAGE
    });
    return `${this.baseUrl}${CURRENT_WEATHER_PATH}?${query.toString()}`;
  }
}
