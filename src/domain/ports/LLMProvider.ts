import { Conversation } from '../entities/Conversation';

export type JsonSchemaPropertyType = 'string' | 'number' | 'boolean';

export interface JsonSchemaProperty {
  readonly type: JsonSchemaPropertyType;
  readonly description: string;
  readonly enum?: readonly string[];
}

export interface JsonSchemaObject {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, JsonSchemaProperty>>;
  readonly required: readonly string[];
}

export interface LLMToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: JsonSchemaObject;
}

export interface LLMToolCall {
  readonly id: string;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface LLMToolResult {
  readonly callId: string;
  readonly toolName: string;
  readonly content: string;
}

export interface LLMToolRound {
  readonly calls: readonly LLMToolCall[];
  readonly results: readonly LLMToolResult[];
}

export interface LLMGenerationRequest {
  readonly systemPrompt: string;
  readonly conversation: Conversation;
  readonly tools: readonly LLMToolDefinition[];
  readonly toolRounds: readonly LLMToolRound[];
}

export interface LLMCompletion {
  readonly text: string | null;
  readonly toolCalls: readonly LLMToolCall[];
}

export interface LLMProvider {
  generate(request: LLMGenerationRequest): Promise<LLMCompletion>;
}
