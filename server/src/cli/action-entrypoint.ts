import { appendFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { createOctokitClient } from '../lib/octokitClient';
import { logger } from '../lib/logger';
import { GithubActionsAdapter } from '../ingestion/githubActionsAdapter';
import { ingestRepo } from '../ingestion/ingestRepo';
import { recomputeAndQuarantine } from '../pipeline';
import { buildActionSummary } from './actionSummary';

/** Entrypoint for the packaged GitHub Action (see action/). Runs the same ingest ->
 *  recompute -> quarantine pipeline as the CLI, then writes a job summary and outputs. */
async function main(): Promise<void> {
  const [repoArg, maxRunsArg] = process.argv.slice(2);
  const [owner, repo] = (repoArg ?? '').split('/');
  if (!owner || !repo) {
    throw new Error(`Expected "owner/name" as the first argument, got "${repoArg}"`);
  }
  const maxRuns = maxRunsArg ? Number(maxRunsArg) : undefined;
  const repoKey = `${owner}/${repo}`;

  const prisma = new PrismaClient();
  const octokit = createOctokitClient();
  const adapter = new GithubActionsAdapter(octokit.rest.actions);

  try {
    const ingestResult = await ingestRepo(prisma, adapter, { owner, repo, maxRuns });
    logger.info({ repo: repoKey, ...ingestResult }, 'ingestion complete');

    await recomputeAndQuarantine(prisma, repoKey);

    const tests = await prisma.test.findMany({
      where: { repo: repoKey },
      include: {
        scores: { orderBy: { computedAt: 'desc' }, take: 1 },
        quarantineEvents: { orderBy: { occurredAt: 'desc' }, take: 1 },
      },
    });

    const summary = buildActionSummary(
      repoKey,
      tests.map((t) => ({
        name: t.name,
        suite: t.suite,
        quarantineStatus: t.quarantineEvents[0]?.transitionedTo ?? 'STABLE',
        confidenceScore: t.scores[0]?.confidenceScore ?? null,
      })),
    );

    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.markdown);
    }
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `quarantined-count=${summary.quarantinedCount}\nflagged-count=${summary.flaggedCount}\n`,
      );
    }

    logger.info(
      { repo: repoKey, quarantined: summary.quarantinedCount, flagged: summary.flaggedCount },
      'flaky-test-detector action complete',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  logger.error({ err }, 'flaky-test-detector action failed');
  process.exitCode = 1;
});
