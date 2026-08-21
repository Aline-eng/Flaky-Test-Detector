import { countFlips, type RunOutcome } from './flipRate';
import { wilsonScoreInterval } from './wilsonScore';
import type { FlakinessComputation, FlakinessConfig, FlakinessStatus, ScorableRun } from './types';

function toOutcome(status: ScorableRun['status']): RunOutcome | null {
  if (status === 'PASSED') return 'pass';
  if (status === 'FAILED' || status === 'ERRORED') return 'fail';
  return null; // SKIPPED
}

function classify(
  confidenceScore: number,
  nonSkippedRuns: number,
  config: FlakinessConfig,
): FlakinessStatus {
  if (nonSkippedRuns < config.minRuns) return 'STABLE';
  if (confidenceScore >= config.quarantineThreshold) return 'QUARANTINED';
  if (confidenceScore >= config.flagThreshold) return 'FLAGGED';
  return 'STABLE';
}

/**
 * Computes a flakiness score for one test from its run history. `runs` must already be
 * limited to the configured sliding window and sorted oldest-first.
 *
 * The confidence score is the Wilson lower bound on the flip rate, not the flip rate itself
 * — this is what keeps a test with one flip in two runs from being treated the same as one
 * with a genuinely sustained 50% flip rate over many runs.
 */
export function computeFlakinessScore(
  runs: ScorableRun[],
  config: FlakinessConfig,
): FlakinessComputation {
  const outcomes = runs.map((r) => toOutcome(r.status)).filter((o): o is RunOutcome => o !== null);

  const flips = countFlips(outcomes);
  const trials = Math.max(outcomes.length - 1, 0);
  const flipRate = trials > 0 ? flips / trials : 0;
  const { lowerBound: confidenceScore } = wilsonScoreInterval(flips, trials);

  const windowStart = runs[0]?.startedAt ?? new Date(0);
  const windowEnd = runs[runs.length - 1]?.startedAt ?? new Date(0);

  return {
    windowStart,
    windowEnd,
    runsConsidered: runs.length,
    flips,
    flipRate,
    confidenceScore,
    status: classify(confidenceScore, outcomes.length, config),
  };
}
