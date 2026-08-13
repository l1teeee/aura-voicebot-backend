import OpenAI from 'openai';
import { ProcessUserMessageUseCase } from './application/use-cases/ProcessUserMessageUseCase';
import { Env, loadEnv } from './config/env';
import { ConversationRepository } from './domain/ports/ConversationRepository';
import { InteractionLogger } from './domain/ports/InteractionLogger';
import { LLMProvider } from './domain/ports/LLMProvider';
import { WeatherProvider } from './domain/ports/WeatherProvider';
import { OPENAI_REQUEST_TIMEOUT_MS } from './infrastructure/constants';
import { HttpClient } from './infrastructure/http/HttpClient';
import { OpenAILLMProvider } from './infrastructure/llm/OpenAILLMProvider';
import { WebhookInteractionLogger } from './infrastructure/logging/WebhookInteractionLogger';
import { InMemoryConversationRepository } from './infrastructure/persistence/InMemoryConversationRepository';
import { OpenWeatherMapProvider } from './infrastructure/weather/OpenWeatherMapProvider';
import { ChatController } from './interfaces/http/controllers/ChatController';

const WEATHER_SERVICE_NAME = 'openweathermap';
const LOG_WEBHOOK_SERVICE_NAME = 'log-webhook';

export interface AppContainer {
  readonly env: Env;
  readonly chatController: ChatController;
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

  const processUserMessageUseCase = new ProcessUserMessageUseCase(
    llmProvider,
    weatherProvider,
    interactionLogger,
    conversationRepository
  );

  const chatController = new ChatController(processUserMessageUseCase);

  const shutdown = (): void => {
    inMemoryConversationRepository.stopPeriodicCleanup();
  };

  return { env, chatController, shutdown };
};
