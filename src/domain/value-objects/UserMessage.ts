import { MAX_USER_MESSAGE_LENGTH, MIN_USER_MESSAGE_LENGTH } from '../constants';
import { ValidationError } from '../errors/ValidationError';

export class UserMessage {
  private readonly text: string;

  private constructor(text: string) {
    this.text = text;
  }

  static create(raw: string): UserMessage {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_USER_MESSAGE_LENGTH) {
      throw new ValidationError('El mensaje está vacío. Escribe algo y vuelve a intentarlo.');
    }
    if (trimmed.length > MAX_USER_MESSAGE_LENGTH) {
      throw new ValidationError(
        `El mensaje es demasiado largo. Usa como máximo ${MAX_USER_MESSAGE_LENGTH} caracteres.`
      );
    }
    return new UserMessage(trimmed);
  }

  get content(): string {
    return this.text;
  }

  toString(): string {
    return this.text;
  }
}
