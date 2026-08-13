import { ValidationError } from '../../domain/errors/ValidationError';
import { UserRepository } from '../../domain/ports/UserRepository';
import { MIN_USER_NAME_LENGTH, MAX_USER_NAME_LENGTH } from '../../domain/constants';
import { normalizeKey } from '../../domain/utils/normalizeKey';
import { IdentifyUserInput } from '../dto/IdentifyUserInput';
import {
  IdentifyUserConversation,
  IdentifyUserMessage,
  IdentifyUserOutput
} from '../dto/IdentifyUserOutput';

const invalidNameMessage = 'El nombre debe tener entre 2 y 40 caracteres.';

const mapConversation = (conversation: {
  readonly sessionId: string;
  readonly startedAt: Date;
  readonly interactions: readonly {
    readonly userMessage: string;
    readonly botReply: string;
    readonly createdAt: Date;
  }[];
}): IdentifyUserConversation => {
  const messages: IdentifyUserMessage[] = [];

  for (const interaction of conversation.interactions) {
    const createdAt = interaction.createdAt.toISOString();
    messages.push(
      { role: 'user', text: interaction.userMessage, createdAt },
      { role: 'bot', text: interaction.botReply, createdAt }
    );
  }

  return {
    sessionId: conversation.sessionId,
    startedAt: conversation.startedAt.toISOString(),
    messages
  };
};

export class IdentifyUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(input: IdentifyUserInput): Promise<IdentifyUserOutput> {
    const name = normalizeKey(input.name);

    if (name.length < MIN_USER_NAME_LENGTH || name.length > MAX_USER_NAME_LENGTH) {
      throw new ValidationError(invalidNameMessage);
    }

    const existingUser = await this.userRepository.findByName(name);

    if (existingUser !== null) {
      return {
        userId: existingUser.id,
        isReturning: true,
        conversations: existingUser.conversations.map(mapConversation)
      };
    }

    const createdUser = await this.userRepository.create(name);

    return {
      userId: createdUser.id,
      isReturning: false,
      conversations: []
    };
  }
}
