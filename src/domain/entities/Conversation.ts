import { CONVERSATION_TTL_MS, MAX_TURNS_PER_CONVERSATION } from '../constants';
import { SessionId } from '../value-objects/SessionId';
import { UserMessage } from '../value-objects/UserMessage';
import { ConversationTurn } from './ConversationTurn';
import { Message } from './Message';

export class Conversation {
  private readonly session: SessionId;

  private readonly closedTurns: ConversationTurn[];

  private pendingUserMessage: Message | null;

  private lastActivity: Date;

  private constructor(session: SessionId, startedAt: Date) {
    this.session = session;
    this.closedTurns = [];
    this.pendingUserMessage = null;
    this.lastActivity = startedAt;
  }

  static start(sessionId: SessionId): Conversation {
    return new Conversation(sessionId, new Date());
  }

  get sessionId(): SessionId {
    return this.session;
  }

  get turns(): readonly ConversationTurn[] {
    return [...this.closedTurns];
  }

  get history(): readonly Message[] {
    const messages: Message[] = [];
    for (const turn of this.closedTurns) {
      messages.push(...turn.messages);
    }
    if (this.pendingUserMessage !== null) {
      messages.push(this.pendingUserMessage);
    }
    return messages;
  }

  get lastActivityAt(): Date {
    return new Date(this.lastActivity.getTime());
  }

  addUserMessage(userMessage: UserMessage): void {
    this.pendingUserMessage = Message.fromUser(userMessage.content);
    this.refreshLastActivity();
  }

  completeTurn(assistantReply: string): void {
    if (this.pendingUserMessage === null) {
      return;
    }
    const assistantMessage = Message.fromAssistant(assistantReply);
    this.closedTurns.push(ConversationTurn.create(this.pendingUserMessage, assistantMessage));
    this.pendingUserMessage = null;
    this.discardOldestTurnsBeyondLimit();
    this.refreshLastActivity();
  }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() - this.lastActivity.getTime() > CONVERSATION_TTL_MS;
  }

  private discardOldestTurnsBeyondLimit(): void {
    const turnsOverLimit = this.closedTurns.length - MAX_TURNS_PER_CONVERSATION;
    if (turnsOverLimit > 0) {
      this.closedTurns.splice(0, turnsOverLimit);
    }
  }

  private refreshLastActivity(): void {
    this.lastActivity = new Date();
  }
}
