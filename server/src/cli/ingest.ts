import { PrismaClient } from '@prisma/client';
import { createOctokitClient } from '../lib/octokitClient';
import { logger } from '../lib/logger';
import { GithubActionsAdapter } from '../ingestion/githubActionsAdapter';
import { ingestRepo } from '../ingestion/ingestRepo';
import { recomputeAndQuarantine } from '../pipeline';
import { parseRepoFlag } from './parseRepoArg';

const USAGE = 'Usage: npm run ingest -- --repo owner/name [--max-runs N]';

interface CliArgs {
  owner: string;
  repo: string;
  maxRuns?: number;
}

export function parseArgs(argv: string[]): CliArgs {
  const { owner, repo } = parseRepoFlag(argv, USAGE);

  const maxRunsIndex = argv.indexOf('--max-runs');
  const maxRunsArg = maxRunsIndex !== -1 ? argv[maxRunsIndex + 1] : undefined;
  const maxRuns = maxRunsArg !== undefined ? Number(maxRunsArg) : undefined;
  if (maxRuns !== undefined && (!Number.isInteger(maxRuns) || maxRuns <= 0)) {
    throw new Error(`--max-runs must be a positive integer, got "${maxRunsArg}"`);
  }

  return { owner, repo, maxRuns };
}

async function main(): Promise<void> {
  const { owner, repo, maxRuns } = parseArgs(process.argv.slice(2));
  const repoKey = `${owner}/${repo}`;

  const prisma = new PrismaClient();
  const octokit = createOctokitClient();
  const adapter = new GithubActionsAdapter(octokit.rest.actions);

  try {
    logger.info({ owner, repo, maxRuns }, 'starting ingestion');
    const ingestResult = await ingestRepo(prisma, adapter, { owner, repo, maxRuns });
    logger.info({ owner, repo, ...ingestResult }, 'ingestion complete');

    await recomputeAndQuarantine(prisma, repoKey);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'ingestion failed');
    process.exitCode = 1;
  });
}
