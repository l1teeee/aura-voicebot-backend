export interface ProcessUserMessageInput {
  readonly sessionId: string;
  readonly message: string;
  readonly userId?: string;
}
