export type IdentifyUserMessageRole = 'user' | 'bot';

export interface IdentifyUserMessage {
  readonly role: IdentifyUserMessageRole;
  readonly text: string;
  readonly createdAt: string;
}

export interface IdentifyUserConversation {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly messages: readonly IdentifyUserMessage[];
}

export interface IdentifyUserOutput {
  readonly userId: string;
  readonly isReturning: boolean;
  readonly conversations: readonly IdentifyUserConversation[];
}
