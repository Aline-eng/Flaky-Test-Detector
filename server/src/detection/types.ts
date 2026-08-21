import type { TestRunStatus } from '@prisma/client';

export type FlakinessStatus = 'STABLE' | 'FLAGGED' | 'QUARANTINED';

export interface ScorableRun {
  status: TestRunStatus;
  startedAt: Date;
}

export interface FlakinessConfig {
  /** Max number of most-recent runs to consider. */
  windowSize: number;
  /** Runs older than this many days are excluded even if the window isn't full. */
  windowMaxAgeDays: number;
  /** Below this many non-skipped runs in the window, a test is always STABLE — too little
   *  data to claim anything, regardless of what the raw numbers say. */
  minRuns: number;
  /** Confidence-score threshold at/above which a test is FLAGGED. */
  flagThreshold: number;
  /** Confidence-score threshold at/above which a test is QUARANTINED. */
  quarantineThreshold: number;
}

export interface FlakinessComputation {
  windowStart: Date;
  windowEnd: Date;
  runsConsidered: number;
  flips: number;
  flipRate: number;
  confidenceScore: number;
  status: FlakinessStatus;
}
