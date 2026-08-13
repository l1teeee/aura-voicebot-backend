export type InteractionMetadataValue = string | number | boolean;

export interface InteractionRecord {
  readonly sessionId: string;
  readonly timestamp: string;
  readonly userMessage: string;
  readonly botReply: string;
  readonly toolsUsed: readonly string[];
  readonly metadata: Readonly<Record<string, InteractionMetadataValue>>;
}

export interface InteractionLogger {
  log(record: InteractionRecord): Promise<void>;
}
