import { PrismaClient } from '@prisma/client';
import { logger } from '../lib/logger';
import { recomputeAndQuarantine } from '../pipeline';
import { parseRepoFlag } from './parseRepoArg';

const USAGE = 'Usage: npm run recompute -- --repo owner/name';

async function main(): Promise<void> {
  const { owner, repo } = parseRepoFlag(process.argv.slice(2), USAGE);
  const repoKey = `${owner}/${repo}`;

  const prisma = new PrismaClient();
  try {
    await recomputeAndQuarantine(prisma, repoKey);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'recompute failed');
    process.exitCode = 1;
  });
}
