import { MAX_SPEECH_TEXT_LENGTH, MIN_SPEECH_TEXT_LENGTH } from '../../domain/constants';
import { ValidationError } from '../../domain/errors/ValidationError';
import { SpeechProvider, SynthesizedSpeech } from '../../domain/ports/SpeechProvider';
import { SynthesizeSpeechInput } from '../dto/SynthesizeSpeechInput';

const invalidTextMessage = `El texto a sintetizar debe tener entre ${MIN_SPEECH_TEXT_LENGTH} y ${MAX_SPEECH_TEXT_LENGTH} caracteres.`;

export class SynthesizeSpeechUseCase {
  constructor(private readonly speechProvider: SpeechProvider) {}

  async execute(input: SynthesizeSpeechInput): Promise<SynthesizedSpeech> {
    const text = input.text.trim();

    if (text.length < MIN_SPEECH_TEXT_LENGTH || text.length > MAX_SPEECH_TEXT_LENGTH) {
      throw new ValidationError(invalidTextMessage);
    }

    return this.speechProvider.synthesize(text);
  }
}
