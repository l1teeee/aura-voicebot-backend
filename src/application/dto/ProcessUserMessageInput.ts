export interface ProcessUserMessageInput {
  readonly sessionId: string;
  readonly message: string;
  readonly userId?: string;
  readonly image?: {
    readonly mimeType: string;
    readonly data: string;
  };
}
