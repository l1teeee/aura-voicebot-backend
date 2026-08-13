export type MessageRole = 'user' | 'assistant';

export class Message {
  private readonly messageRole: MessageRole;

  private readonly text: string;

  private readonly createdAt: Date;

  private constructor(messageRole: MessageRole, text: string, createdAt: Date) {
    this.messageRole = messageRole;
    this.text = text;
    this.createdAt = createdAt;
  }

  static fromUser(content: string): Message {
    return new Message('user', content, new Date());
  }

  static fromAssistant(content: string): Message {
    return new Message('assistant', content, new Date());
  }

  get role(): MessageRole {
    return this.messageRole;
  }

  get content(): string {
    return this.text;
  }

  get timestamp(): Date {
    return new Date(this.createdAt.getTime());
  }
}
