import { TemperatureUnits } from '../domain/ports/WeatherProvider';

export const MAX_TOOL_ITERATIONS: number = 3;

export const TOOL_NAMES = {
  weatherLookup: 'consultarClima',
  logInteraction: 'registrarInteraccion'
} as const;

export const ACTION_TYPES = {
  weatherLookup: 'weather_lookup',
  interactionLog: 'interaction_log'
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

export const WEATHER_LOOKUP_FAILED_MESSAGE: string =
  'El servicio del clima no está disponible ahora mismo.';

export const UNKNOWN_TOOL_MESSAGE: string = 'Esa herramienta no existe.';

export const INTERACTION_LOG_CONFIRMATION_MESSAGE: string = 'La interacción quedó registrada.';

export const PENDING_BOT_REPLY: string = '';
