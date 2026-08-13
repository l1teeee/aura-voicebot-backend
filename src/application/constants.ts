import { TemperatureUnits } from '../domain/ports/WeatherProvider';

export const MAX_TOOL_ITERATIONS: number = 3;

export const TOOL_NAMES = {
  weatherLookup: 'consultarClima',
  forecastLookup: 'consultarPronostico',
  logInteraction: 'registrarInteraccion',
  addFavoriteCity: 'guardarCiudadFavorita',
  listFavoriteCities: 'listarCiudadesFavoritas'
} as const;

export const ACTION_TYPES = {
  weatherLookup: 'weather_lookup',
  interactionLog: 'interaction_log',
  favoriteCityAdded: 'favorite_city_added'
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

export const TEMPERATURE_UNIT_VALUES = ['metric', 'imperial'] as const;

export const DEFAULT_TEMPERATURE_UNITS: TemperatureUnits = 'metric';

export const MIN_TOOL_ARGUMENT_LENGTH: number = 1;

export const MAX_CITY_NAME_LENGTH: number = 120;

export const MAX_INTERACTION_SUMMARY_LENGTH: number = 500;

export const FALLBACK_REPLY: string =
  'Perdona, no conseguí preparar una respuesta. ¿Me lo repites?';

export const TOOL_LIMIT_FALLBACK_REPLY: string =
  'Me estoy enredando con esa consulta. ¿Lo intentamos otra vez?';

export const INVALID_WEATHER_ARGUMENTS_MESSAGE: string =
  'No llegó una ciudad válida para consultar el clima. Pídesela a la persona en una sola frase.';

export const INVALID_LOG_ARGUMENTS_MESSAGE: string =
  'No llegó un resumen válido, así que no se registró nada.';

export const INVALID_FAVORITE_CITY_ARGUMENTS_MESSAGE: string =
  'No llegó una ciudad válida para guardar. Pídesela a la persona en una sola frase.';

export const INVALID_FAVORITE_CITY_LIST_ARGUMENTS_MESSAGE: string =
  'No se necesitan datos para consultar las ciudades favoritas.';

export const IDENTIFICATION_REQUIRED_MESSAGE: string =
  'La persona necesita identificarse primero para usar ciudades favoritas.';

export const FAVORITE_CITY_SAVE_FAILED_MESSAGE: string =
  'No se pudo guardar la ciudad favorita. Explícalo con naturalidad y sugiere intentarlo de nuevo.';

export const FAVORITE_CITY_LIST_FAILED_MESSAGE: string =
  'No se pudieron consultar las ciudades favoritas. Explícalo con naturalidad y sugiere intentarlo de nuevo.';

export const WEATHER_LOOKUP_FAILED_MESSAGE: string =
  'El servicio del clima no está disponible ahora mismo.';

export const TOOL_FAILURE_LOG_PREFIX: string = 'Fallo la herramienta';

export const INTERACTION_PERSISTENCE_FAILURE_LOG_PREFIX: string =
  'Fallo al guardar la interacción del usuario en Postgres.';

export const UNKNOWN_TOOL_MESSAGE: string = 'Esa herramienta no existe.';

export const INTERACTION_LOG_CONFIRMATION_MESSAGE: string = 'La interacción quedó registrada.';

export const PENDING_BOT_REPLY: string = '';
