import 'dotenv/config';
import { z } from 'zod';

const DEFAULT_PORT = 3000;
const MAX_PORT_NUMBER = 65535;
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_OPENAI_TTS_VOICE = 'coral';
const NODE_ENVIRONMENTS = ['development', 'production', 'test'] as const;
const DEFAULT_NODE_ENVIRONMENT = 'development';
const UNKNOWN_VARIABLE_LABEL = 'entorno';
const DATABASE_URL_REASON = 'debe ser una URL válida de PostgreSQL';
const INVALID_ENVIRONMENT_HEADER =
  'Configuración de entorno inválida. Revisa tu archivo .env tomando .env.example como plantilla. Variables con problemas:';

export type NodeEnvironment = (typeof NODE_ENVIRONMENTS)[number];

export interface Env {
  readonly port: number;
  readonly nodeEnv: NodeEnvironment;
  readonly openAiApiKey: string;
  readonly openAiModel: string;
  readonly openAiTtsModel: string;
  readonly openAiTtsVoice: string;
  readonly openWeatherApiKey: string;
  readonly openWeatherBaseUrl: string;
  readonly logWebhookUrl: string;
  readonly allowedOrigin: string;
  readonly databaseUrl: string | undefined;
}

const requiredText = (reason: string): z.ZodString =>
  z.string({ required_error: reason, invalid_type_error: reason }).min(1, reason);

const requiredUrl = (reason: string): z.ZodString =>
  z.string({ required_error: reason, invalid_type_error: reason }).url(reason);

const PORT_REASON = 'debe ser un número entero positivo';

const envSchema = z.object({
  PORT: z.coerce
    .number({ invalid_type_error: PORT_REASON })
    .int(PORT_REASON)
    .positive(PORT_REASON)
    .max(MAX_PORT_NUMBER, `no puede superar ${MAX_PORT_NUMBER}`)
    .default(DEFAULT_PORT),
  NODE_ENV: z
    .enum(NODE_ENVIRONMENTS, {
      errorMap: () => ({ message: `debe ser uno de: ${NODE_ENVIRONMENTS.join(', ')}` }),
    })
    .default(DEFAULT_NODE_ENVIRONMENT),
  OPENAI_API_KEY: requiredText('falta la clave de la API de OpenAI'),
  OPENAI_MODEL: requiredText('debe ser un identificador de modelo no vacío').default(
    DEFAULT_OPENAI_MODEL
  ),
  OPENAI_TTS_MODEL: requiredText('debe ser un identificador de modelo de voz no vacío').default(
    DEFAULT_OPENAI_TTS_MODEL
  ),
  OPENAI_TTS_VOICE: requiredText('debe ser un identificador de voz no vacío').default(
    DEFAULT_OPENAI_TTS_VOICE
  ),
  OPENWEATHER_API_KEY: requiredText('falta la clave de la API de OpenWeatherMap'),
  OPENWEATHER_BASE_URL: requiredUrl('debe ser una URL válida de la API de OpenWeatherMap'),
  LOG_WEBHOOK_URL: requiredUrl('debe ser una URL válida del webhook de registro'),
  ALLOWED_ORIGIN: requiredText('debe indicar el origen permitido por CORS'),
  DATABASE_URL: z
    .string({ invalid_type_error: DATABASE_URL_REASON })
    .url(DATABASE_URL_REASON)
    .optional(),
});

const describeIssue = (issue: z.ZodIssue): string => {
  const variableName = issue.path.length > 0 ? issue.path.join('.') : UNKNOWN_VARIABLE_LABEL;
  return `  - ${variableName}: ${issue.message}`;
};

export const loadEnv = (): Env => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const details = result.error.issues.map(describeIssue).join('\n');
    throw new Error(`${INVALID_ENVIRONMENT_HEADER}\n${details}`);
  }

  return {
    port: result.data.PORT,
    nodeEnv: result.data.NODE_ENV,
    openAiApiKey: result.data.OPENAI_API_KEY,
    openAiModel: result.data.OPENAI_MODEL,
    openAiTtsModel: result.data.OPENAI_TTS_MODEL,
    openAiTtsVoice: result.data.OPENAI_TTS_VOICE,
    openWeatherApiKey: result.data.OPENWEATHER_API_KEY,
    openWeatherBaseUrl: result.data.OPENWEATHER_BASE_URL,
    logWebhookUrl: result.data.LOG_WEBHOOK_URL,
    allowedOrigin: result.data.ALLOWED_ORIGIN,
    databaseUrl: result.data.DATABASE_URL,
  };
};
