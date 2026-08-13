import { UUID_V4_PATTERN } from '../constants';
import { ValidationError } from '../errors/ValidationError';

export class SessionId {
  private readonly rawValue: string;

  private constructor(rawValue: string) {
    this.rawValue = rawValue;
  }

  static create(raw: string): SessionId {
    const normalized = raw.trim().toLowerCase();
    if (!UUID_V4_PATTERN.test(normalized)) {
      throw new ValidationError(
        'El identificador de sesión no es válido. Debe ser un identificador UUID de versión 4.'
      );
    }
    return new SessionId(normalized);
  }

  get value(): string {
    return this.rawValue;
  }

  equals(other: SessionId): boolean {
    return this.rawValue === other.rawValue;
  }

  toString(): string {
    return this.rawValue;
  }
}
