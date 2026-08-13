import { Conversation } from '../entities/Conversation';
import { SessionId } from '../value-objects/SessionId';

export interface ConversationRepository {
  findBySessionId(sessionId: SessionId): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}
