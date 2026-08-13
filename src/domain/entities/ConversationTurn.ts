import { Message } from './Message';

export class ConversationTurn {
  private readonly user: Message;

  private readonly assistant: Message;

  private constructor(user: Message, assistant: Message) {
    this.user = user;
    this.assistant = assistant;
  }

  static create(userMessage: Message, assistantMessage: Message): ConversationTurn {
    return new ConversationTurn(userMessage, assistantMessage);
  }

  get userMessage(): Message {
    return this.user;
  }

  get assistantMessage(): Message {
    return this.assistant;
  }

  get messages(): readonly Message[] {
    return [this.user, this.assistant];
  }
}
