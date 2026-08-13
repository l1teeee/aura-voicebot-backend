import { ActionType } from '../constants';

export interface ProcessUserMessageAction {
  readonly type: ActionType;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ProcessUserMessageOutput {
  readonly reply: string;
  readonly sessionId: string;
  readonly action?: ProcessUserMessageAction;
}
