import type { TestRunStatus } from '@prisma/client';
import { recomputeFlakinessScores, type RecomputeStore } from '../recompute';
import type { FlakinessComputation, FlakinessConfig, ScorableRun } from '../types';

const FIXED_NOW = new Date('2026-01-31T00:00:00.000Z');

const CONFIG: FlakinessConfig = {
  windowSize: 50,
  windowMaxAgeDays: 30,
  minRuns: 4,
  flagThreshold: 0.1,
  quarantineThreshold: 0.3,
};

function runsFrom(statuses: TestRunStatus[]): ScorableRun[] {
  // Most-recent-first, matching the RecomputeStore.listRecentRuns contract.
  return statuses
    .map((status, i) => ({ status, startedAt: new Date(Date.UTC(2026, 0, i + 1)) }))
    .reverse();
}

function createFakeStore(runsByTest: Record<string, ScorableRun[]>): RecomputeStore & {
  saved: Map<string, FlakinessComputation>;
} {
  const saved = new Map<string, FlakinessComputation>();
  return {
    saved,
    async listTestIds() {
      return Object.keys(runsByTest);
    },
    async listRecentRuns(testId, _sinceDate, limit) {
      return (runsByTest[testId] ?? []).slice(0, limit);
    },
    async saveFlakinessScore(testId, computation) {
      saved.set(testId, computation);
    },
  };
}

describe('recomputeFlakinessScores', () => {
  it('scores every test for the repo and tallies flagged/quarantined counts', async () => {
    const store = createFakeStore({
      stableTest: runsFrom(['PASSED', 'PASSED', 'PASSED', 'PASSED']),
      flaggedTest: runsFrom(['PASSED', 'PASSED', 'FAILED', 'FAILED', 'PASSED', 'PASSED']),
      quarantinedTest: runsFrom(['PASSED', 'FAILED', 'PASSED', 'FAILED', 'PASSED', 'FAILED']),
    });

    const summary = await recomputeFlakinessScores(store, {
      repo: 'o/r',
      config: CONFIG,
      now: () => FIXED_NOW,
    });

    expect(summary).toEqual({ testsScored: 3, flagged: 1, quarantined: 1 });
    expect(store.saved.get('stableTest')?.status).toBe('STABLE');
    expect(store.saved.get('flaggedTest')?.status).toBe('FLAGGED');
    expect(store.saved.get('quarantinedTest')?.status).toBe('QUARANTINED');
  });

  it('saves one score per test even when a test has no runs in the window', async () => {
    const store = createFakeStore({ newTest: [] });

    const summary = await recomputeFlakinessScores(store, {
      repo: 'o/r',
      config: CONFIG,
      now: () => FIXED_NOW,
    });

    expect(summary).toEqual({ testsScored: 1, flagged: 0, quarantined: 0 });
    expect(store.saved.get('newTest')?.status).toBe('STABLE');
  });
});
