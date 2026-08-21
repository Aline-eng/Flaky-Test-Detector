import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { PrismaTestsRepository } from './api/testsRepository';

const prisma = new PrismaClient();
const app = createApp({ testsRepository: new PrismaTestsRepository(prisma) });

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'server started');
});
