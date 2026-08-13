export const MILLISECONDS_PER_SECOND: number = 1000;

export const SECONDS_PER_MINUTE: number = 60;

export const CONVERSATION_TTL_MINUTES: number = 30;

export const MAX_TURNS_PER_CONVERSATION: number = 20;

export const CONVERSATION_TTL_MS: number =
  CONVERSATION_TTL_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

export const MIN_USER_MESSAGE_LENGTH: number = 1;

export const MAX_USER_MESSAGE_LENGTH: number = 1000;

export const MIN_SPEECH_TEXT_LENGTH: number = 1;

export const MAX_SPEECH_TEXT_LENGTH: number = 800;

export const MIN_USER_NAME_LENGTH: number = 2;

export const MAX_USER_NAME_LENGTH: number = 40;

export const UUID_V4_PATTERN: RegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DOMAIN_ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  cityNotFound: 'CITY_NOT_FOUND',
  rateLimitExceeded: 'RATE_LIMIT_EXCEEDED',
  llmUnavailable: 'LLM_UNAVAILABLE',
  externalService: 'EXTERNAL_SERVICE_ERROR'
} as const;
