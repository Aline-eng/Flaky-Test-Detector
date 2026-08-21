import { computeFlakinessScore } from './computeFlakinessScore';
import type { FlakinessComputation, FlakinessConfig, ScorableRun } from './types';

/** Narrow persistence boundary the recompute job needs — satisfied by PrismaRecomputeStore
 *  in production and by a lightweight in-memory fake in tests. */
export interface RecomputeStore {
  listTestIds(repo: string): Promise<string[]>;
  /** Up to `limit` most-recent runs at/after `sinceDate`, ordered most-recent-first. */
  listRecentRuns(testId: string, sinceDate: Date, limit: number): Promise<ScorableRun[]>;
  saveFlakinessScore(testId: string, computation: FlakinessComputation): Promise<void>;
}

export interface RecomputeOptions {
  repo: string;
  config: FlakinessConfig;
  now?: () => Date;
}

export interface RecomputeSummary {
  testsScored: number;
  flagged: number;
  quarantined: number;
}

export async function recomputeFlakinessScores(
  store: RecomputeStore,
  options: RecomputeOptions,
): Promise<RecomputeSummary> {
  const now = (options.now ?? (() => new Date()))();
  const cutoff = new Date(now.getTime() - options.config.windowMaxAgeDays * 24 * 60 * 60 * 1000);

  const testIds = await store.listTestIds(options.repo);
  const summary: RecomputeSummary = { testsScored: 0, flagged: 0, quarantined: 0 };

  for (const testId of testIds) {
    const mostRecentFirst = await store.listRecentRuns(testId, cutoff, options.config.windowSize);
    const chronological = [...mostRecentFirst].reverse();

    const computation = computeFlakinessScore(chronological, options.config);
    await store.saveFlakinessScore(testId, computation);

    summary.testsScored += 1;
    if (computation.status === 'FLAGGED') summary.flagged += 1;
    if (computation.status === 'QUARANTINED') summary.quarantined += 1;
  }

  return summary;
}
