import { Conversation } from '../../domain/entities/Conversation';
import { DomainError } from '../../domain/errors/DomainError';
import { ExternalServiceError } from '../../domain/errors/ExternalServiceError';
import { ConversationRepository } from '../../domain/ports/ConversationRepository';
import {
  InteractionLogger,
  InteractionMetadataValue,
  InteractionRecord
} from '../../domain/ports/InteractionLogger';
import {
  LLMCompletion,
  LLMProvider,
  LLMToolCall,
  LLMToolResult,
  LLMToolRound
} from '../../domain/ports/LLMProvider';
import { UserRepository } from '../../domain/ports/UserRepository';
import { WeatherProvider, WeatherSnapshot } from '../../domain/ports/WeatherProvider';
import { SessionId } from '../../domain/value-objects/SessionId';
import { UserMessage } from '../../domain/value-objects/UserMessage';
import {
  ACTION_TYPES,
  FALLBACK_REPLY,
  FAVORITE_CITY_LIST_FAILED_MESSAGE,
  FAVORITE_CITY_SAVE_FAILED_MESSAGE,
  IDENTIFICATION_REQUIRED_MESSAGE,
  INTERACTION_LOG_CONFIRMATION_MESSAGE,
  INTERACTION_PERSISTENCE_FAILURE_LOG_PREFIX,
  INVALID_FAVORITE_CITY_ARGUMENTS_MESSAGE,
  INVALID_FAVORITE_CITY_LIST_ARGUMENTS_MESSAGE,
  INVALID_LOG_ARGUMENTS_MESSAGE,
  INVALID_WEATHER_ARGUMENTS_MESSAGE,
  MAX_TOOL_ITERATIONS,
  PENDING_BOT_REPLY,
  TOOL_FAILURE_LOG_PREFIX,
  TOOL_LIMIT_FALLBACK_REPLY,
  TOOL_NAMES,
  UNKNOWN_TOOL_MESSAGE,
  WEATHER_LOOKUP_FAILED_MESSAGE
} from '../constants';
import { ProcessUserMessageInput } from '../dto/ProcessUserMessageInput';
import { ProcessUserMessageAction, ProcessUserMessageOutput } from '../dto/ProcessUserMessageOutput';
import { AURA_SYSTEM_PROMPT } from '../prompts/auraSystemPrompt';
import {
  addFavoriteCityToolArgumentsSchema,
  forecastToolArgumentsSchema,
  listFavoriteCitiesToolArgumentsSchema,
  logInteractionToolArgumentsSchema,
  weatherToolArgumentsSchema
} from '../tools/toolArgumentSchemas';
import { AVAILABLE_TOOLS } from '../tools/toolCatalog';
import { AddFavoriteCityUseCase } from './AddFavoriteCityUseCase';
import { ListFavoriteCitiesUseCase } from './ListFavoriteCitiesUseCase';

interface InteractionContext {
  readonly sessionId: SessionId;
  readonly userMessage: UserMessage;
  readonly userId?: string;
  readonly image?: {
    readonly mimeType: string;
    readonly data: string;
  };
}

interface ToolCallOutcome {
  readonly result: LLMToolResult;
  readonly executedToolName: string | null;
  readonly weatherSnapshot: WeatherSnapshot | null;
}

interface ToolRoundOutcome {
  readonly round: LLMToolRound;
  readonly executedToolNames: readonly string[];
  readonly weatherSnapshot: WeatherSnapshot | null;
}

interface ToolLoopOutcome {
  readonly replyText: string | null;
  readonly toolsUsed: readonly string[];
  readonly weatherSnapshot: WeatherSnapshot | null;
  readonly iterationsUsed: number;
  readonly iterationLimitReached: boolean;
}

const extractText = (completion: LLMCompletion): string | null => {
  if (completion.text === null) {
    return null;
  }

  const normalizedText = completion.text.trim();

  return normalizedText.length === 0 ? null : normalizedText;
};

const resolveReply = (outcome: ToolLoopOutcome): string => {
  if (outcome.replyText !== null) {
    return outcome.replyText;
  }

  return outcome.iterationLimitReached ? TOOL_LIMIT_FALLBACK_REPLY : FALLBACK_REPLY;
};

const buildToolResult = (call: LLMToolCall, content: string): LLMToolResult => ({
  callId: call.id,
  toolName: call.toolName,
  content
});

const buildErrorContent = (message: string): string => JSON.stringify({ error: message });

const describeWeatherFailure = (error: unknown): string =>
  error instanceof DomainError ? error.message : WEATHER_LOOKUP_FAILED_MESSAGE;

const describeFavoriteCityFailure = (error: unknown, fallback: string): string =>
  error instanceof DomainError ? error.message : fallback;

const logToolFailure = (toolName: string, city: string, error: unknown): void => {
  const status = error instanceof ExternalServiceError ? ` status: ${String(error.status)}` : '';
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`${TOOL_FAILURE_LOG_PREFIX} ${toolName}. ciudad: ${city}.${status} ${detail}`);
};

const logInteractionPersistenceFailure = (error: unknown): void => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`${INTERACTION_PERSISTENCE_FAILURE_LOG_PREFIX} ${detail}`);
};

const buildAction = (outcome: ToolLoopOutcome): ProcessUserMessageAction | null => {
  if (outcome.weatherSnapshot !== null) {
    return { type: ACTION_TYPES.weatherLookup, data: { ...outcome.weatherSnapshot } };
  }

  if (outcome.toolsUsed.includes(TOOL_NAMES.addFavoriteCity)) {
    return { type: ACTION_TYPES.favoriteCityAdded, data: {} };
  }

  if (outcome.toolsUsed.includes(TOOL_NAMES.logInteraction)) {
    return { type: ACTION_TYPES.interactionLog, data: { toolsUsed: outcome.toolsUsed } };
  }

  return null;
};

const buildOutput = (
  context: InteractionContext,
  reply: string,
  outcome: ToolLoopOutcome
): ProcessUserMessageOutput => {
  const action = buildAction(outcome);

  if (action === null) {
    return { reply, sessionId: context.sessionId.value };
  }

  return { reply, sessionId: context.sessionId.value, action };
};

const buildInteractionRecord = (
  context: InteractionContext,
  reply: string,
  outcome: ToolLoopOutcome
): InteractionRecord => {
  const metadata: Record<string, InteractionMetadataValue> = {
    requestedByModel: false,
    llmIterations: outcome.iterationsUsed
  };

  if (outcome.iterationLimitReached) {
    metadata.iterationLimitReached = true;
  }

  if (outcome.weatherSnapshot !== null) {
    metadata.weatherCity = outcome.weatherSnapshot.city;
  }

  return {
    sessionId: context.sessionId.value,
    timestamp: new Date().toISOString(),
    userMessage: context.userMessage.content,
    botReply: reply,
    toolsUsed: outcome.toolsUsed,
    metadata
  };
};

export class ProcessUserMessageUseCase {
  constructor(
    private readonly llmProvider: LLMProvider,
    private readonly weatherProvider: WeatherProvider,
    private readonly interactionLogger: InteractionLogger,
    private readonly conversationRepository: ConversationRepository,
    private readonly userRepository: UserRepository | undefined,
    private readonly addFavoriteCity: AddFavoriteCityUseCase,
    private readonly listFavoriteCities: ListFavoriteCitiesUseCase
  ) {}

  async execute(input: ProcessUserMessageInput): Promise<ProcessUserMessageOutput> {
    const sessionId = SessionId.create(input.sessionId);
    const userMessage = UserMessage.create(input.message);
    const conversation = await this.resolveConversation(sessionId);

    conversation.addUserMessage(userMessage);

    const context: InteractionContext = {
      sessionId,
      userMessage,
      userId: input.userId,
      image: input.image
    };
    const outcome = await this.runToolLoop(conversation, context);
    const reply = resolveReply(outcome);

    conversation.completeTurn(reply);
    await this.conversationRepository.save(conversation);
    await this.persistUserInteraction(input.userId, sessionId.value, userMessage.content, reply);

    void this.interactionLogger.log(buildInteractionRecord(context, reply, outcome));

    return buildOutput(context, reply, outcome);
  }

  private async resolveConversation(sessionId: SessionId): Promise<Conversation> {
    const storedConversation = await this.conversationRepository.findBySessionId(sessionId);

    return storedConversation ?? Conversation.start(sessionId);
  }

  private async persistUserInteraction(
    userId: string | undefined,
    sessionId: string,
    userMessage: string,
    botReply: string
  ): Promise<void> {
    if (userId === undefined || this.userRepository?.saveInteraction === undefined) {
      return;
    }

    try {
      await this.userRepository.saveInteraction(
        userId,
        sessionId,
        userMessage,
        botReply,
        new Date()
      );
    } catch (error: unknown) {
      logInteractionPersistenceFailure(error);
    }
  }

  private async runToolLoop(
    conversation: Conversation,
    context: InteractionContext
  ): Promise<ToolLoopOutcome> {
    const toolRounds: LLMToolRound[] = [];
    const toolsUsed = new Set<string>();
    let latestText: string | null = null;
    let weatherSnapshot: WeatherSnapshot | null = null;
    let iterationsUsed = 0;

    while (iterationsUsed < MAX_TOOL_ITERATIONS) {
      iterationsUsed += 1;

      const completion = await this.llmProvider.generate({
        systemPrompt: AURA_SYSTEM_PROMPT,
        conversation,
        tools: AVAILABLE_TOOLS,
        toolRounds,
        image:
          context.image === undefined
            ? undefined
            : { mimeType: context.image.mimeType, base64: context.image.data }
      });
      const completionText = extractText(completion);

      if (completion.toolCalls.length === 0) {
        return {
          replyText: completionText,
          toolsUsed: Array.from(toolsUsed),
          weatherSnapshot,
          iterationsUsed,
          iterationLimitReached: false
        };
      }

      latestText = completionText ?? latestText;

      const roundOutcome = await this.runToolRound(completion.toolCalls, context);

      toolRounds.push(roundOutcome.round);
      weatherSnapshot = roundOutcome.weatherSnapshot ?? weatherSnapshot;

      for (const toolName of roundOutcome.executedToolNames) {
        toolsUsed.add(toolName);
      }
    }

    return {
      replyText: latestText,
      toolsUsed: Array.from(toolsUsed),
      weatherSnapshot,
      iterationsUsed,
      iterationLimitReached: true
    };
  }

  private async runToolRound(
    calls: readonly LLMToolCall[],
    context: InteractionContext
  ): Promise<ToolRoundOutcome> {
    const results: LLMToolResult[] = [];
    const executedToolNames: string[] = [];
    let weatherSnapshot: WeatherSnapshot | null = null;

    for (const call of calls) {
      const callOutcome = await this.executeToolCall(call, context);

      results.push(callOutcome.result);
      weatherSnapshot = callOutcome.weatherSnapshot ?? weatherSnapshot;

      if (callOutcome.executedToolName !== null) {
        executedToolNames.push(callOutcome.executedToolName);
      }
    }

    return { round: { calls, results }, executedToolNames, weatherSnapshot };
  }

  private async executeToolCall(
    call: LLMToolCall,
    context: InteractionContext
  ): Promise<ToolCallOutcome> {
    if (call.toolName === TOOL_NAMES.weatherLookup) {
      return this.executeWeatherLookup(call);
    }

    if (call.toolName === TOOL_NAMES.forecastLookup) {
      return this.executeForecastLookup(call);
    }

    if (call.toolName === TOOL_NAMES.logInteraction) {
      return this.executeInteractionLog(call, context);
    }

    if (call.toolName === TOOL_NAMES.addFavoriteCity) {
      return this.executeAddFavoriteCity(call, context.userId);
    }

    if (call.toolName === TOOL_NAMES.listFavoriteCities) {
      return this.executeListFavoriteCities(call, context.userId);
    }

    return {
      result: buildToolResult(call, buildErrorContent(UNKNOWN_TOOL_MESSAGE)),
      executedToolName: null,
      weatherSnapshot: null
    };
  }

  private async executeWeatherLookup(call: LLMToolCall): Promise<ToolCallOutcome> {
    const parsedArguments = weatherToolArgumentsSchema.safeParse(call.arguments);

    if (!parsedArguments.success) {
      return {
        result: buildToolResult(call, buildErrorContent(INVALID_WEATHER_ARGUMENTS_MESSAGE)),
        executedToolName: null,
        weatherSnapshot: null
      };
    }

    try {
      const snapshot = await this.weatherProvider.getCurrentWeather(
        parsedArguments.data.city,
        parsedArguments.data.units
      );

      return {
        result: buildToolResult(call, JSON.stringify(snapshot)),
        executedToolName: TOOL_NAMES.weatherLookup,
        weatherSnapshot: snapshot
      };
    } catch (error: unknown) {
      logToolFailure(TOOL_NAMES.weatherLookup, parsedArguments.data.city, error);

      return {
        result: buildToolResult(call, buildErrorContent(describeWeatherFailure(error))),
        executedToolName: TOOL_NAMES.weatherLookup,
        weatherSnapshot: null
      };
    }
  }

  private async executeForecastLookup(call: LLMToolCall): Promise<ToolCallOutcome> {
    const parsedArguments = forecastToolArgumentsSchema.safeParse(call.arguments);

    if (!parsedArguments.success) {
      return {
        result: buildToolResult(call, buildErrorContent(INVALID_WEATHER_ARGUMENTS_MESSAGE)),
        executedToolName: null,
        weatherSnapshot: null
      };
    }

    try {
      const forecast = await this.weatherProvider.getForecast(
        parsedArguments.data.city,
        parsedArguments.data.units
      );

      return {
        result: buildToolResult(call, JSON.stringify(forecast)),
        executedToolName: TOOL_NAMES.forecastLookup,
        weatherSnapshot: null
      };
    } catch (error: unknown) {
      logToolFailure(TOOL_NAMES.forecastLookup, parsedArguments.data.city, error);

      return {
        result: buildToolResult(call, buildErrorContent(describeWeatherFailure(error))),
        executedToolName: TOOL_NAMES.forecastLookup,
        weatherSnapshot: null
      };
    }
  }

  private executeInteractionLog(call: LLMToolCall, context: InteractionContext): ToolCallOutcome {
    const parsedArguments = logInteractionToolArgumentsSchema.safeParse(call.arguments);

    if (!parsedArguments.success) {
      return {
        result: buildToolResult(call, buildErrorContent(INVALID_LOG_ARGUMENTS_MESSAGE)),
        executedToolName: null,
        weatherSnapshot: null
      };
    }

    void this.interactionLogger.log({
      sessionId: context.sessionId.value,
      timestamp: new Date().toISOString(),
      userMessage: context.userMessage.content,
      botReply: PENDING_BOT_REPLY,
      toolsUsed: [TOOL_NAMES.logInteraction],
      metadata: { requestedByModel: true, summary: parsedArguments.data.summary }
    });

    return {
      result: buildToolResult(
        call,
        JSON.stringify({ registered: true, detail: INTERACTION_LOG_CONFIRMATION_MESSAGE })
      ),
      executedToolName: TOOL_NAMES.logInteraction,
      weatherSnapshot: null
    };
  }

  private async executeAddFavoriteCity(
    call: LLMToolCall,
    userId: string | undefined
  ): Promise<ToolCallOutcome> {
    const parsedArguments = addFavoriteCityToolArgumentsSchema.safeParse(call.arguments);

    if (!parsedArguments.success) {
      return {
        result: buildToolResult(call, buildErrorContent(INVALID_FAVORITE_CITY_ARGUMENTS_MESSAGE)),
        executedToolName: null,
        weatherSnapshot: null
      };
    }

    if (userId === undefined) {
      return {
        result: buildToolResult(call, buildErrorContent(IDENTIFICATION_REQUIRED_MESSAGE)),
        executedToolName: TOOL_NAMES.addFavoriteCity,
        weatherSnapshot: null
      };
    }

    try {
      const favoriteCity = await this.addFavoriteCity.execute({
        userId,
        city: parsedArguments.data.city
      });

      return {
        result: buildToolResult(call, JSON.stringify(favoriteCity)),
        executedToolName: TOOL_NAMES.addFavoriteCity,
        weatherSnapshot: null
      };
    } catch (error: unknown) {
      return {
        result: buildToolResult(
          call,
          buildErrorContent(describeFavoriteCityFailure(error, FAVORITE_CITY_SAVE_FAILED_MESSAGE))
        ),
        executedToolName: TOOL_NAMES.addFavoriteCity,
        weatherSnapshot: null
      };
    }
  }

  private async executeListFavoriteCities(
    call: LLMToolCall,
    userId: string | undefined
  ): Promise<ToolCallOutcome> {
    const parsedArguments = listFavoriteCitiesToolArgumentsSchema.safeParse(call.arguments);

    if (!parsedArguments.success) {
      return {
        result: buildToolResult(
          call,
          buildErrorContent(INVALID_FAVORITE_CITY_LIST_ARGUMENTS_MESSAGE)
        ),
        executedToolName: null,
        weatherSnapshot: null
      };
    }

    if (userId === undefined) {
      return {
        result: buildToolResult(call, buildErrorContent(IDENTIFICATION_REQUIRED_MESSAGE)),
        executedToolName: TOOL_NAMES.listFavoriteCities,
        weatherSnapshot: null
      };
    }

    try {
      const favoriteCities = await this.listFavoriteCities.execute({ userId });

      return {
        result: buildToolResult(call, JSON.stringify(favoriteCities)),
        executedToolName: TOOL_NAMES.listFavoriteCities,
        weatherSnapshot: null
      };
    } catch (error: unknown) {
      return {
        result: buildToolResult(
          call,
          buildErrorContent(describeFavoriteCityFailure(error, FAVORITE_CITY_LIST_FAILED_MESSAGE))
        ),
        executedToolName: TOOL_NAMES.listFavoriteCities,
        weatherSnapshot: null
      };
    }
  }
}
