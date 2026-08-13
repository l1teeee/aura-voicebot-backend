import { Conversation } from '../../domain/entities/Conversation';
import { DomainError } from '../../domain/errors/DomainError';
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
  INTERACTION_LOG_CONFIRMATION_MESSAGE,
  INVALID_LOG_ARGUMENTS_MESSAGE,
  INVALID_WEATHER_ARGUMENTS_MESSAGE,
  MAX_TOOL_ITERATIONS,
  PENDING_BOT_REPLY,
  TOOL_LIMIT_FALLBACK_REPLY,
  TOOL_NAMES,
  UNKNOWN_TOOL_MESSAGE,
  WEATHER_LOOKUP_FAILED_MESSAGE
} from '../constants';
import { ProcessUserMessageInput } from '../dto/ProcessUserMessageInput';
import { ProcessUserMessageAction, ProcessUserMessageOutput } from '../dto/ProcessUserMessageOutput';
import { AURA_SYSTEM_PROMPT } from '../prompts/auraSystemPrompt';
import {
  logInteractionToolArgumentsSchema,
  weatherToolArgumentsSchema
} from '../tools/toolArgumentSchemas';
import { AVAILABLE_TOOLS } from '../tools/toolCatalog';

interface InteractionContext {
  readonly sessionId: SessionId;
  readonly userMessage: UserMessage;
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

const buildAction = (outcome: ToolLoopOutcome): ProcessUserMessageAction | null => {
  if (outcome.weatherSnapshot !== null) {
    return { type: ACTION_TYPES.weatherLookup, data: { ...outcome.weatherSnapshot } };
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
    private readonly userRepository?: UserRepository
  ) {}

  async execute(input: ProcessUserMessageInput): Promise<ProcessUserMessageOutput> {
    const sessionId = SessionId.create(input.sessionId);
    const userMessage = UserMessage.create(input.message);
    const conversation = await this.resolveConversation(sessionId);

    conversation.addUserMessage(userMessage);

    const context: InteractionContext = { sessionId, userMessage };
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

    await this.userRepository.saveInteraction(
      userId,
      sessionId,
      userMessage,
      botReply,
      new Date()
    );
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
        toolRounds
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

    if (call.toolName === TOOL_NAMES.logInteraction) {
      return this.executeInteractionLog(call, context);
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
      return {
        result: buildToolResult(call, buildErrorContent(describeWeatherFailure(error))),
        executedToolName: TOOL_NAMES.weatherLookup,
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
}
