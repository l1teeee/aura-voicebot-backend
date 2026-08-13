export interface UserInteraction {
  readonly userMessage: string;
  readonly botReply: string;
  readonly createdAt: Date;
}

export interface UserConversation {
  readonly sessionId: string;
  readonly startedAt: Date;
  readonly interactions: readonly UserInteraction[];
}

export class User {
  private constructor(
    private readonly identifier: string,
    private readonly displayName: string,
    private readonly history: readonly UserConversation[]
  ) {}

  static fromPersistence(
    id: string,
    name: string,
    conversations: readonly UserConversation[]
  ): User {
    return new User(id, name, conversations);
  }

  get id(): string {
    return this.identifier;
  }

  get name(): string {
    return this.displayName;
  }

  get conversations(): readonly UserConversation[] {
    return this.history;
  }
}
