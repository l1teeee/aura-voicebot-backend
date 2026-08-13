export interface SynthesizedSpeech {
  readonly contentType: string;
  readonly audio: AsyncIterable<Uint8Array>;
}

export interface SpeechProvider {
  synthesize(text: string): Promise<SynthesizedSpeech>;
}
