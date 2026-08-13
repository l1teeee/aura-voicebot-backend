import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { AppContainer, createContainer } from './container';
import {
  HTTP_STATUS,
  NOT_FOUND_ERROR_CODE,
  NOT_FOUND_ERROR_MESSAGE,
  SPEECH_RATE_LIMIT_MAX_REQUESTS,
} from './interfaces/http/constants';
import { createCorsMiddleware } from './interfaces/http/middlewares/cors';
import { errorHandler } from './interfaces/http/middlewares/errorHandler';
import { RateLimiter, createRateLimiter } from './interfaces/http/middlewares/rateLimiter';
import { requestLogger } from './interfaces/http/middlewares/requestLogger';
import { createChatRouter } from './interfaces/http/routes/chat.routes';
import { createFavoriteCityRouter } from './interfaces/http/routes/favoriteCity.routes';
import { createHealthRouter } from './interfaces/http/routes/health.routes';
import { createIdentifyRouter } from './interfaces/http/routes/identify.routes';
import { createSpeechRouter } from './interfaces/http/routes/speech.routes';

const HEALTH_ROUTE_PREFIX = '/api/health';
const CHAT_ROUTE_PREFIX = '/api/chat';
const IDENTIFY_ROUTE_PREFIX = '/api/identify';
const SPEECH_ROUTE_PREFIX = '/api/speech';
const FAVORITE_CITY_ROUTE_PREFIX = '/api/favorite-cities';
const JSON_BODY_LIMIT = '16kb';
const TRUSTED_PROXY_HOP_COUNT = 1;
const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;
const FORCED_SHUTDOWN_TIMEOUT_MS = 10_000;
const SUCCESS_EXIT_CODE = 0;
const STARTUP_FAILURE_EXIT_CODE = 1;
const FORCED_SHUTDOWN_EXIT_CODE = 1;
const STARTUP_FAILURE_MESSAGE = 'No se pudo iniciar Aura backend.';
const SERVER_ERROR_MESSAGE = 'Error irrecuperable del servidor HTTP:';
const FORCED_SHUTDOWN_MESSAGE = 'Cierre forzoso: el servidor no terminó a tiempo.';
const SHUTDOWN_COMPLETED_MESSAGE = 'Aura backend detenido correctamente.';

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const notFoundHandler = (_request: Request, response: Response): void => {
  response.status(HTTP_STATUS.notFound).json({
    error: { code: NOT_FOUND_ERROR_CODE, message: NOT_FOUND_ERROR_MESSAGE },
  });
};

const createApp = (
  container: AppContainer,
  chatRateLimiter: RateLimiter,
  speechRateLimiter: RateLimiter
): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', TRUSTED_PROXY_HOP_COUNT);

  app.use(requestLogger);
  app.use(createCorsMiddleware(container.env.allowedOrigin));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(HEALTH_ROUTE_PREFIX, createHealthRouter());
  app.use(IDENTIFY_ROUTE_PREFIX, createIdentifyRouter(container.identifyUserController));
  app.use(
    FAVORITE_CITY_ROUTE_PREFIX,
    createFavoriteCityRouter(container.favoriteCityController)
  );
  app.use(
    CHAT_ROUTE_PREFIX,
    chatRateLimiter.middleware,
    createChatRouter(container.chatController)
  );
  app.use(
    SPEECH_ROUTE_PREFIX,
    speechRateLimiter.middleware,
    createSpeechRouter(container.speechController)
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

const registerShutdownHandlers = (
  server: Server,
  container: AppContainer,
  rateLimiters: readonly RateLimiter[]
): void => {
  let shutdownInProgress = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shutdownInProgress) {
      return;
    }
    shutdownInProgress = true;
    console.info(`Señal ${signal} recibida. Cerrando Aura backend...`);

    const forcedExitTimer = setTimeout(() => {
      console.error(FORCED_SHUTDOWN_MESSAGE);
      process.exit(FORCED_SHUTDOWN_EXIT_CODE);
    }, FORCED_SHUTDOWN_TIMEOUT_MS);
    forcedExitTimer.unref();

    server.close(() => {
      clearTimeout(forcedExitTimer);
      container.shutdown();
      rateLimiters.forEach((rateLimiter) => rateLimiter.stop());
      console.info(SHUTDOWN_COMPLETED_MESSAGE);
      process.exit(SUCCESS_EXIT_CODE);
    });
  };

  SHUTDOWN_SIGNALS.forEach((signal) => {
    process.once(signal, shutdown);
  });
};

const startServer = (): void => {
  try {
    const container = createContainer();
    const chatRateLimiter = createRateLimiter();
    const speechRateLimiter = createRateLimiter(SPEECH_RATE_LIMIT_MAX_REQUESTS);
    const app = createApp(container, chatRateLimiter, speechRateLimiter);

    const server = app.listen(container.env.port, () => {
      console.info(
        `Aura backend escuchando en el puerto ${container.env.port} (entorno ${container.env.nodeEnv}).`
      );
    });

    server.on('error', (error: Error) => {
      console.error(`${SERVER_ERROR_MESSAGE} ${error.message}`);
      process.exit(STARTUP_FAILURE_EXIT_CODE);
    });

    registerShutdownHandlers(server, container, [chatRateLimiter, speechRateLimiter]);
  } catch (error) {
    console.error(`${STARTUP_FAILURE_MESSAGE} ${describeError(error)}`);
    process.exit(STARTUP_FAILURE_EXIT_CODE);
  }
};

startServer();
