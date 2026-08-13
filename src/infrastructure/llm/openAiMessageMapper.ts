import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool
} from 'openai/resources/chat/completions';

import type { Conversation } from '../../domain/entities/Conversation';
import type { Message } from '../../domain/entities/Message';
import type {
  JsonSchemaObject,
  JsonSchemaProperty,
  LLMToolCall,
  LLMToolDefinition,
  LLMToolRound
} from '../../domain/ports/LLMProvider';

const FUNCTION_TOOL_TYPE = 'function';

const toHistoryMessage = (message: Message): ChatCompletionMessageParam =>
  message.role === 'user'
    ? { role: 'user', content: message.content }
    : { role: 'assistant', content: message.content };

const toAssistantToolCallsMessage = (
  calls: readonly LLMToolCall[]
): ChatCompletionAssistantMessageParam => ({
  role: 'assistant',
  content: null,
  tool_calls: calls.map(
    (call): ChatCompletionMessageToolCall => ({
      id: call.id,
      type: FUNCTION_TOOL_TYPE,
      function: {
        name: call.toolName,
        arguments: JSON.stringify(call.arguments)
      }
    })
  )
});

const toSchemaProperty = (property: JsonSchemaProperty): Record<string, unknown> => {
  const mapped: Record<string, unknown> = {
    type: property.type,
    description: property.description
  };
  if (property.enum !== undefined) {
    mapped['enum'] = [...property.enum];
  }
  return mapped;
};

const toSchemaProperties = (
  properties: Readonly<Record<string, JsonSchemaProperty>>
): Record<string, unknown> => {
  const mapped: Record<string, unknown> = {};
  for (const [propertyName, property] of Object.entries(properties)) {
    mapped[propertyName] = toSchemaProperty(property);
  }
  return mapped;
};

const toFunctionParameters = (parameters: JsonSchemaObject): Record<string, unknown> => ({
  type: parameters.type,
  properties: toSchemaProperties(parameters.properties),
  required: [...parameters.required]
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const toChatCompletionMessages = (
  systemPrompt: string,
  conversation: Conversation,
  toolRounds: readonly LLMToolRound[]
): ChatCompletionMessageParam[] => {
  const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: systemPrompt }];
  for (const message of conversation.history) {
    messages.push(toHistoryMessage(message));
  }
  for (const round of toolRounds) {
    messages.push(toAssistantToolCallsMessage(round.calls));
    for (const result of round.results) {
      messages.push({ role: 'tool', tool_call_id: result.callId, content: result.content });
    }
  }
  return messages;
};

export const toChatCompletionTools = (
  tools: readonly LLMToolDefinition[]
): ChatCompletionTool[] =>
  tools.map(
    (tool): ChatCompletionTool => ({
      type: FUNCTION_TOOL_TYPE,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: toFunctionParameters(tool.parameters)
      }
    })
  );

export const parseToolCallArguments = (rawArguments: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(rawArguments);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
