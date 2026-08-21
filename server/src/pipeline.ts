import type { PrismaClient } from '@prisma/client';
import { env } from './config/env';
import { logger } from './lib/logger';
import { loadFlakinessConfigFromEnv } from './detection/config';
import { PrismaRecomputeStore } from './detection/prismaRecomputeStore';
import { recomputeFlakinessScores } from './detection/recompute';
import { applyQuarantineTransitions } from './quarantine/applyQuarantineTransitions';
import { PrismaQuarantineStore } from './quarantine/prismaQuarantineStore';
import { SlackQuarantineNotifier } from './quarantine/slackNotifier';

/** Recomputes flakiness scores, then evaluates quarantine transitions against the fresh
 *  scores — the standard pipeline run after every ingestion, and available standalone for
 *  scheduled/manual triggering. */
export async function recomputeAndQuarantine(prisma: PrismaClient, repo: string): Promise<void> {
  const recomputeSummary = await recomputeFlakinessScores(new PrismaRecomputeStore(prisma), {
    repo,
    config: loadFlakinessConfigFromEnv(),
  });
  logger.info({ repo, ...recomputeSummary }, 'flakiness recompute complete');

  const quarantineSummary = await applyQuarantineTransitions(
    new PrismaQuarantineStore(prisma),
    new SlackQuarantineNotifier(env.SLACK_WEBHOOK_URL),
    { repo, cleanRunsRequired: env.QUARANTINE_CLEAN_RUNS_REQUIRED },
  );
  logger.info({ repo, ...quarantineSummary }, 'quarantine evaluation complete');
}
