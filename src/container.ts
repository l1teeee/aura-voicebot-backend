import OpenAI from 'openai';
import { Pool } from 'pg';
import { IdentifyUserUseCase } from './application/use-cases/IdentifyUserUseCase';
import { ProcessUserMessageUseCase } from './application/use-cases/ProcessUserMessageUseCase';
import { Env, loadEnv } from './config/env';
import { ConversationRepository } from './domain/ports/ConversationRepository';
import { InteractionLogger } from './domain/ports/InteractionLogger';
import { LLMProvider } from './domain/ports/LLMProvider';
import { UserRepository } from './domain/ports/UserRepository';
import { WeatherProvider } from './domain/ports/WeatherProvider';
import { OPENAI_REQUEST_TIMEOUT_MS } from './infrastructure/constants';
import { HttpClient } from './infrastructure/http/HttpClient';
import { OpenAILLMProvider } from './infrastructure/llm/OpenAILLMProvider';
import { WebhookInteractionLogger } from './infrastructure/logging/WebhookInteractionLogger';
import { InMemoryConversationRepository } from './infrastructure/persistence/InMemoryConversationRepository';
import { PostgresUserRepository } from './infrastructure/persistence/PostgresUserRepository';
import { OpenWeatherMapProvider } from './infrastructure/weather/OpenWeatherMapProvider';
import { ChatController } from './interfaces/http/controllers/ChatController';
import { IdentifyUserController } from './interfaces/http/controllers/IdentifyUserController';

const WEATHER_SERVICE_NAME = 'openweathermap';
const LOG_WEBHOOK_SERVICE_NAME = 'log-webhook';

export interface AppContainer {
  readonly env: Env;
  readonly chatController: ChatController;
  readonly identifyUserController: IdentifyUserController;
  readonly shutdown: () => void;
}

export const createContainer = (): AppContainer => {
  const env = loadEnv();

  const openAiClient = new OpenAI({
    apiKey: env.openAiApiKey,
    timeout: OPENAI_REQUEST_TIMEOUT_MS,
  });

  const weatherHttpClient = new HttpClient(WEATHER_SERVICE_NAME);
  const logWebhookHttpClient = new HttpClient(LOG_WEBHOOK_SERVICE_NAME);

  const llmProvider: LLMProvider = new OpenAILLMProvider(openAiClient, env.openAiModel);

  const weatherProvider: WeatherProvider = new OpenWeatherMapProvider(
    weatherHttpClient,
    env.openWeatherApiKey,
    env.openWeatherBaseUrl
  );

  const interactionLogger: InteractionLogger = new WebhookInteractionLogger(
    logWebhookHttpClient,
    env.logWebhookUrl
  );

  const inMemoryConversationRepository = new InMemoryConversationRepository();
  inMemoryConversationRepository.startPeriodicCleanup();
  const conversationRepository: ConversationRepository = inMemoryConversationRepository;
  const postgresPool = new Pool(
    env.databaseUrl === undefined ? {} : { connectionString: env.databaseUrl }
  );
  const userRepository: UserRepository = new PostgresUserRepository(postgresPool);

  const processUserMessageUseCase = new ProcessUserMessageUseCase(
    llmProvider,
    weatherProvider,
    interactionLogger,
    conversationRepository,
    userRepository
  );
  const identifyUserUseCase = new IdentifyUserUseCase(userRepository);

  const chatController = new ChatController(processUserMessageUseCase);
  const identifyUserController = new IdentifyUserController(identifyUserUseCase);

  const shutdown = (): void => {
    inMemoryConversationRepository.stopPeriodicCleanup();
    void postgresPool.end();
  };

  return { env, chatController, identifyUserController, shutdown };
};
