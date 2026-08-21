import type { FlakinessStatus } from '../detection/types';
import { decideQuarantineTransition } from './stateMachine';
import type { QuarantineNotifier } from './notifier';
import type { QuarantineStatus, QuarantineTransition, TestSummary } from './types';

/** Narrow persistence boundary the quarantine job needs — satisfied by PrismaQuarantineStore
 *  in production and by a lightweight in-memory fake in tests. */
export interface QuarantineStore {
  listTests(repo: string): Promise<TestSummary[]>;
  /** The status from the most recently computed FlakinessScore, or null if never scored. */
  getLatestFlakinessStatus(testId: string): Promise<FlakinessStatus | null>;
  /** Current quarantine status and when it started, derived from the latest QuarantineEvent
   *  (or STABLE / epoch if the test has never transitioned). */
  getCurrentQuarantineState(testId: string): Promise<{ status: QuarantineStatus; since: Date }>;
  /** Consecutive PASSED runs (skipping SKIPPED, broken by any FAILED/ERRORED) since `since`. */
  countConsecutiveCleanRunsSince(testId: string, since: Date): Promise<number>;
  recordTransition(testId: string, transition: QuarantineTransition): Promise<void>;
}

export interface QuarantineOptions {
  repo: string;
  cleanRunsRequired: number;
}

export interface QuarantineSummary {
  testsEvaluated: number;
  transitions: number;
}

export async function applyQuarantineTransitions(
  store: QuarantineStore,
  notifier: QuarantineNotifier,
  options: QuarantineOptions,
): Promise<QuarantineSummary> {
  const tests = await store.listTests(options.repo);
  const summary: QuarantineSummary = { testsEvaluated: 0, transitions: 0 };

  for (const test of tests) {
    const detectedStatus = await store.getLatestFlakinessStatus(test.id);
    if (detectedStatus === null) continue; // never scored yet, nothing to act on

    const current = await store.getCurrentQuarantineState(test.id);
    const consecutiveCleanRuns =
      current.status === 'QUARANTINED'
        ? await store.countConsecutiveCleanRunsSince(test.id, current.since)
        : 0;

    const transition = decideQuarantineTransition(
      current.status,
      detectedStatus,
      consecutiveCleanRuns,
      options.cleanRunsRequired,
    );

    summary.testsEvaluated += 1;
    if (!transition) continue;

    await store.recordTransition(test.id, transition);
    summary.transitions += 1;

    if (transition.toStatus === 'QUARANTINED') {
      await notifier.notifyQuarantined(test, transition.reason);
    }
  }

  return summary;
}
