import { User } from '../entities/User';

export interface UserRepository {
  findByName(name: string): Promise<User | null>;
  create(name: string): Promise<User>;
  saveInteraction?(
    userId: string,
    sessionId: string,
    userMessage: string,
    botReply: string,
    createdAt: Date
  ): Promise<void>;
}
