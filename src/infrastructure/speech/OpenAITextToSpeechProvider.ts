import type { OpenAI } from 'openai';
import type { SpeechCreateParams } from 'openai/resources/audio/speech';

import { ExternalServiceError } from '../../domain/errors/ExternalServiceError';
import type { SpeechProvider, SynthesizedSpeech } from '../../domain/ports/SpeechProvider';

export const VOICE_INSTRUCTIONS = [
  'Voz: cercana y cálida, con una sonrisa que se nota al hablar.',
  'Tono: el de una amiga contándote algo en la cocina, no el de una locutora ni el de un contestador automático. Cómoda, sin prisa por impresionar.',
  'Ritmo: conversacional y variado. Acelera un poco cuando algo te hace gracia o te entusiasma, y baja el ritmo en el dato importante. Nada de cadencia plana ni de recitado.',
  'Pausas: respira de forma natural entre ideas y deja un silencio pequeño antes de un remate con gracia.',
  'Emoción: expresiva pero contenida. Se te nota si algo te parece una lástima o una buena noticia.',
  'Pronunciación: español neutro, articulación relajada, sin marcar de más las eses ni las consonantes finales.',
  'Nunca suenes solemne, ni comercial, ni como un anuncio.'
].join(' ');

const SPEECH_SERVICE_NAME = 'OpenAI Text To Speech';
const AUDIO_RESPONSE_FORMAT: SpeechCreateParams['response_format'] = 'mp3';
const AUDIO_CONTENT_TYPE = 'audio/mpeg';
const SYNTHESIS_FAILURE_MESSAGE =
  'No se pudo generar el audio de la respuesta. Inténtalo de nuevo en unos instantes.';
const EMPTY_AUDIO_MESSAGE = 'El servicio de voz devolvió una respuesta sin audio.';

type SpeechResponse = Awaited<ReturnType<OpenAI['audio']['speech']['create']>>;

const closeAudioIterator = async (iterator: AsyncIterator<Uint8Array>): Promise<void> => {
  try {
    await iterator.return?.();
  } catch {
    // El cierre no debe ocultar el resultado original del stream.
  }
};

const continueAudioStream = async function* (
  firstChunk: Uint8Array,
  iterator: AsyncIterator<Uint8Array>,
  responseStatus: number
): AsyncGenerator<Uint8Array> {
  try {
    yield firstChunk;

    let nextChunk = await iterator.next();
    while (!nextChunk.done) {
      if (nextChunk.value.byteLength > 0) {
        yield nextChunk.value;
      }
      nextChunk = await iterator.next();
    }
  } catch {
    throw new ExternalServiceError(
      SPEECH_SERVICE_NAME,
      responseStatus,
      SYNTHESIS_FAILURE_MESSAGE
    );
  } finally {
    await closeAudioIterator(iterator);
  }
};

export class OpenAITextToSpeechProvider implements SpeechProvider {
  private readonly client: OpenAI;

  private readonly model: string;

  private readonly voice: string;

  constructor(client: OpenAI, model: string, voice: string) {
    this.client = client;
    this.model = model;
    this.voice = voice;
  }

  async synthesize(text: string): Promise<SynthesizedSpeech> {
    const response = await this.createSpeech(text);
    const audio = response.body;

    if (audio === null) {
      throw new ExternalServiceError(SPEECH_SERVICE_NAME, response.status, EMPTY_AUDIO_MESSAGE);
    }

    const iterator = audio[Symbol.asyncIterator]();

    try {
      let firstChunk = await iterator.next();
      while (!firstChunk.done && firstChunk.value.byteLength === 0) {
        firstChunk = await iterator.next();
      }

      if (firstChunk.done) {
        throw new ExternalServiceError(SPEECH_SERVICE_NAME, response.status, EMPTY_AUDIO_MESSAGE);
      }

      return {
        contentType: AUDIO_CONTENT_TYPE,
        audio: continueAudioStream(firstChunk.value, iterator, response.status)
      };
    } catch (error) {
      await closeAudioIterator(iterator);

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        SPEECH_SERVICE_NAME,
        response.status,
        SYNTHESIS_FAILURE_MESSAGE
      );
    }
  }

  private async createSpeech(text: string): Promise<SpeechResponse> {
    try {
      return await this.client.audio.speech.create({
        model: this.model,
        voice: this.voice,
        input: text,
        instructions: VOICE_INSTRUCTIONS,
        response_format: AUDIO_RESPONSE_FORMAT
      });
    } catch {
      throw new ExternalServiceError(SPEECH_SERVICE_NAME, null, SYNTHESIS_FAILURE_MESSAGE);
    }
  }
}
