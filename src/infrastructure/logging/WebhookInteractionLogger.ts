import type { InteractionLogger, InteractionRecord } from '../../domain/ports/InteractionLogger';
import type { HttpClient, HttpMethod } from '../http/HttpClient';

const WEBHOOK_METHOD: HttpMethod = 'POST';
const WEBHOOK_FAILURE_MESSAGE = 'No se pudo registrar la interaccion en el webhook externo.';

export class WebhookInteractionLogger implements InteractionLogger {
  private readonly httpClient: HttpClient;

  private readonly webhookUrl: string;

  constructor(httpClient: HttpClient, webhookUrl: string) {
    this.httpClient = httpClient;
    this.webhookUrl = webhookUrl;
  }

  async log(record: InteractionRecord): Promise<void> {
    try {
      await this.httpClient.request(this.webhookUrl, {
        method: WEBHOOK_METHOD,
        body: record
      });
    } catch {
      console.error(`${WEBHOOK_FAILURE_MESSAGE} sessionId: ${record.sessionId}`);
    }
  }
}
