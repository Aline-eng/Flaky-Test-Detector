import express, { type Express } from 'express';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger';
import { createTestsRouter } from './api/testsRouter';
import type { TestsRepository } from './api/testsRepository';

export interface CreateAppDeps {
  testsRepository: TestsRepository;
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/tests', createTestsRouter(deps.testsRepository));

  return app;
}
