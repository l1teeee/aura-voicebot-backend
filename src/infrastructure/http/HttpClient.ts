import { ExternalServiceError } from '../../domain/errors/ExternalServiceError';
import {
  DEFAULT_HTTP_TIMEOUT_MS,
  HTTP_SUCCESS_MAX_STATUS,
  HTTP_SUCCESS_MIN_STATUS,
  MAX_RETRY_ATTEMPTS,
  RETRY_BACKOFF_FACTOR,
  RETRY_BASE_DELAY_MS,
  RETRYABLE_STATUS_CODES
} from '../constants';

export type HttpMethod = 'GET' | 'POST';

export interface HttpRequestOptions {
  readonly method?: HttpMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

interface SuccessfulAttempt {
  readonly kind: 'success';
  readonly response: HttpResponse;
}

interface FailedAttempt {
  readonly kind: 'failure';
  readonly status: number | null;
  readonly retryable: boolean;
  readonly message: string;
}

type RequestAttempt = SuccessfulAttempt | FailedAttempt;

const DEFAULT_HTTP_METHOD: HttpMethod = 'GET';
const CONTENT_TYPE_HEADER = 'Content-Type';
const JSON_CONTENT_TYPE = 'application/json';

const delayFor = (durationMs: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, durationMs);
  });

const isSuccessStatus = (status: number): boolean =>
  status >= HTTP_SUCCESS_MIN_STATUS && status <= HTTP_SUCCESS_MAX_STATUS;

const parseJsonText = (rawBody: string): unknown => {
  if (rawBody.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
};

const buildHeaders = (options: HttpRequestOptions): Record<string, string> => {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) {
    headers[CONTENT_TYPE_HEADER] = JSON_CONTENT_TYPE;
  }
  return headers;
};

const serializeBody = (body: unknown): string | undefined =>
  body === undefined ? undefined : JSON.stringify(body);

export class HttpClient {
  private readonly serviceName: string;

  private readonly defaultTimeoutMs: number;

  constructor(serviceName: string, defaultTimeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS) {
    this.serviceName = serviceName;
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async request(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    let attempt = 0;
    for (;;) {
      const result = await this.executeAttempt(url, options);
      if (result.kind === 'success') {
        return result.response;
      }
      if (!result.retryable || attempt >= MAX_RETRY_ATTEMPTS) {
        throw new ExternalServiceError(this.serviceName, result.status, result.message);
      }
      await delayFor(RETRY_BASE_DELAY_MS * RETRY_BACKOFF_FACTOR ** attempt);
      attempt += 1;
    }
  }

  private async executeAttempt(url: string, options: HttpRequestOptions): Promise<RequestAttempt> {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetch(url, {
        method: options.method ?? DEFAULT_HTTP_METHOD,
        headers: buildHeaders(options),
        body: serializeBody(options.body),
        signal: controller.signal
      });
      const body = parseJsonText(await response.text());
      if (isSuccessStatus(response.status)) {
        return { kind: 'success', response: { status: response.status, body } };
      }
      return {
        kind: 'failure',
        status: response.status,
        retryable: RETRYABLE_STATUS_CODES.includes(response.status),
        message: this.buildStatusFailureMessage(response.status)
      };
    } catch {
      return {
        kind: 'failure',
        status: null,
        retryable: false,
        message: this.buildTransportFailureMessage(controller.signal.aborted)
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private buildStatusFailureMessage(status: number): string {
    return `El servicio ${this.serviceName} respondio con un estado ${status}.`;
  }

  private buildTransportFailureMessage(timedOut: boolean): string {
    return timedOut
      ? `El servicio ${this.serviceName} tardo demasiado en responder.`
      : `No se pudo establecer conexion con el servicio ${this.serviceName}.`;
  }
}
