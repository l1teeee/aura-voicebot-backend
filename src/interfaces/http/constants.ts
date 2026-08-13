export const HTTP_STATUS = {
  ok: 200,
  noContent: 204,
  badRequest: 400,
  notFound: 404,
  tooManyRequests: 429,
  internalServerError: 500,
  serviceUnavailable: 503
} as const;

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_MINUTES = 1;

export const RATE_LIMIT_WINDOW_MS =
  RATE_LIMIT_WINDOW_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

export const RATE_LIMIT_MAX_REQUESTS = 30;

export const RATE_LIMIT_CLEANUP_INTERVAL_MS = RATE_LIMIT_WINDOW_MS;

export const NANOSECONDS_PER_MILLISECOND = 1_000_000;

export const REQUEST_DURATION_DECIMAL_PLACES = 1;

export const HEALTH_STATUS_OK = 'ok';

export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';

export const INTERNAL_ERROR_MESSAGE =
  'Ha ocurrido un error inesperado. Inténtalo de nuevo en unos instantes.';

export const CLIENT_ERROR_MIN_STATUS = 400;

export const CLIENT_ERROR_MAX_STATUS = 499;

export const MALFORMED_BODY_MESSAGE =
  'El cuerpo de la petición no es un JSON válido o supera el tamaño permitido.';

export const NOT_FOUND_ERROR_CODE = 'NOT_FOUND';

export const NOT_FOUND_ERROR_MESSAGE = 'El recurso solicitado no existe.';

export const RATE_LIMIT_EXCEEDED_MESSAGE =
  'Has superado el límite de peticiones permitidas. Espera un momento antes de volver a intentarlo.';
