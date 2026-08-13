import type { Conversation } from '../../domain/entities/Conversation';
import type { ConversationRepository } from '../../domain/ports/ConversationRepository';
import type { SessionId } from '../../domain/value-objects/SessionId';
import { SESSION_CLEANUP_INTERVAL_MS } from '../constants';

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, Conversation>();

  private cleanupHandle: ReturnType<typeof setInterval> | null = null;

  findBySessionId(sessionId: SessionId): Promise<Conversation | null> {
    const conversation = this.conversations.get(sessionId.value);
    if (conversation === undefined) {
      return Promise.resolve(null);
    }
    if (conversation.isExpired()) {
      this.conversations.delete(sessionId.value);
      return Promise.resolve(null);
    }
    return Promise.resolve(conversation);
  }

  save(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.sessionId.value, conversation);
    return Promise.resolve();
  }

  startPeriodicCleanup(): void {
    if (this.cleanupHandle !== null) {
      return;
    }
    this.cleanupHandle = setInterval(() => {
      this.removeExpiredConversations();
    }, SESSION_CLEANUP_INTERVAL_MS);
  }

  stopPeriodicCleanup(): void {
    if (this.cleanupHandle === null) {
      return;
    }
    clearInterval(this.cleanupHandle);
    this.cleanupHandle = null;
  }

  private removeExpiredConversations(): void {
    const now = new Date();
    for (const [sessionKey, conversation] of this.conversations) {
      if (conversation.isExpired(now)) {
        this.conversations.delete(sessionKey);
      }
    }
  }
}
