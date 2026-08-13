import type { OpenAI } from 'openai';
import type {
  ChatCompletion,
  ChatCompletionMessageToolCall,
  ChatCompletionToolChoiceOption
} from 'openai/resources/chat/completions';

import { LLMUnavailableError } from '../../domain/errors/LLMUnavailableError';
import type {
  LLMCompletion,
  LLMGenerationRequest,
  LLMProvider,
  LLMToolCall
} from '../../domain/ports/LLMProvider';
import {
  parseToolCallArguments,
  toChatCompletionMessages,
  toChatCompletionTools
} from './openAiMessageMapper';

const AUTOMATIC_TOOL_CHOICE: ChatCompletionToolChoiceOption = 'auto';
const GENERATION_FAILURE_MESSAGE =
  'El asistente no esta disponible en este momento. Intentalo de nuevo en unos instantes.';

const toCompletionText = (content: string | null | undefined): string | null => {
  if (content === null || content === undefined) {
    return null;
  }
  const trimmedContent = content.trim();
  return trimmedContent === '' ? null : trimmedContent;
};

const toDomainToolCalls = (
  toolCalls: readonly ChatCompletionMessageToolCall[] | undefined
): readonly LLMToolCall[] =>
  (toolCalls ?? []).map(
    (toolCall): LLMToolCall => ({
      id: toolCall.id,
      toolName: toolCall.function.name,
      arguments: parseToolCallArguments(toolCall.function.arguments)
    })
  );

export class OpenAILLMProvider implements LLMProvider {
  private readonly client: OpenAI;

  private readonly model: string;

  constructor(client: OpenAI, model: string) {
    this.client = client;
    this.model = model;
  }

  async generate(request: LLMGenerationRequest): Promise<LLMCompletion> {
    const completion = await this.createCompletion(request);
    const message = completion.choices[0]?.message;
    return {
      text: toCompletionText(message?.content),
      toolCalls: toDomainToolCalls(message?.tool_calls)
    };
  }

  private async createCompletion(request: LLMGenerationRequest): Promise<ChatCompletion> {
    try {
      return await this.client.chat.completions.create({
        model: this.model,
        messages: toChatCompletionMessages(
          request.systemPrompt,
          request.conversation,
          request.toolRounds
        ),
        tools: toChatCompletionTools(request.tools),
        tool_choice: AUTOMATIC_TOOL_CHOICE
      });
    } catch {
      throw new LLMUnavailableError(GENERATION_FAILURE_MESSAGE);
    }
  }
}
