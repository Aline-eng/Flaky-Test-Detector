import type { TestRunStatus } from '@prisma/client';
import { computeFlakinessScore } from '../computeFlakinessScore';
import { wilsonScoreInterval } from '../wilsonScore';
import type { FlakinessConfig, ScorableRun } from '../types';

const BASE_CONFIG: FlakinessConfig = {
  windowSize: 50,
  windowMaxAgeDays: 30,
  minRuns: 4,
  flagThreshold: 0.15,
  quarantineThreshold: 0.3,
};

function runsFrom(statuses: TestRunStatus[]): ScorableRun[] {
  return statuses.map((status, i) => ({
    status,
    startedAt: new Date(Date.UTC(2026, 0, i + 1)),
  }));
}

describe('computeFlakinessScore', () => {
  it('computes flip rate and a Wilson-lower-bound confidence score for an alternating test', () => {
    const runs = runsFrom(['PASSED', 'FAILED', 'PASSED', 'FAILED']);
    const result = computeFlakinessScore(runs, BASE_CONFIG);

    expect(result.flips).toBe(3);
    expect(result.flipRate).toBe(1); // 3 flips out of 3 possible transitions
    expect(result.confidenceScore).toBeCloseTo(wilsonScoreInterval(3, 3).lowerBound, 10);
    expect(result.windowStart).toEqual(runs[0].startedAt);
    expect(result.windowEnd).toEqual(runs[3].startedAt);
  });

  it('treats a consistently failing test as not flaky (zero flips)', () => {
    const runs = runsFrom(['FAILED', 'FAILED', 'FAILED', 'FAILED']);
    const result = computeFlakinessScore(runs, BASE_CONFIG);

    expect(result.flips).toBe(0);
    expect(result.flipRate).toBe(0);
    expect(result.status).toBe('STABLE');
  });

  it('excludes SKIPPED runs from both the flip count and the minRuns guard', () => {
    const runs = runsFrom(['PASSED', 'SKIPPED', 'FAILED', 'SKIPPED', 'PASSED']);
    const result = computeFlakinessScore(runs, { ...BASE_CONFIG, minRuns: 3 });

    // Non-skipped sequence is [pass, fail, pass] -> 2 flips out of 2 trials.
    expect(result.flips).toBe(2);
    expect(result.flipRate).toBe(1);
    expect(result.runsConsidered).toBe(5); // raw window size, skipped runs included
  });

  it('stays STABLE below minRuns even with a 100% naive flip rate', () => {
    // Only 2 non-skipped runs, both flipping -- a naive percentage would call this 100%
    // flaky, but there isn't remotely enough data to claim that.
    const runs = runsFrom(['PASSED', 'FAILED']);
    const result = computeFlakinessScore(runs, { ...BASE_CONFIG, minRuns: 6 });

    expect(result.flipRate).toBe(1);
    expect(result.status).toBe('STABLE');
  });

  it('classifies STABLE / FLAGGED / QUARANTINED using the confidence score against thresholds', () => {
    const config: FlakinessConfig = {
      windowSize: 50,
      windowMaxAgeDays: 30,
      minRuns: 4,
      flagThreshold: 0.1,
      quarantineThreshold: 0.3,
    };

    const neverFlips = computeFlakinessScore(
      runsFrom(['PASSED', 'PASSED', 'PASSED', 'PASSED', 'PASSED']),
      config,
    );
    // 0 flips / 4 trials -> Wilson lower bound ~0.00004
    expect(neverFlips.status).toBe('STABLE');

    const occasionalFlip = computeFlakinessScore(
      runsFrom(['PASSED', 'PASSED', 'FAILED', 'FAILED', 'PASSED', 'PASSED']),
      config,
    );
    // 2 flips / 5 trials -> Wilson lower bound ~0.1177 (> 0.1, < 0.3)
    expect(occasionalFlip.confidenceScore).toBeCloseTo(0.1177, 3);
    expect(occasionalFlip.status).toBe('FLAGGED');

    const constantlyFlips = computeFlakinessScore(
      runsFrom(['PASSED', 'FAILED', 'PASSED', 'FAILED', 'PASSED', 'FAILED']),
      config,
    );
    // 5 flips / 5 trials -> Wilson lower bound ~0.565
    expect(constantlyFlips.confidenceScore).toBeCloseTo(0.5655, 3);
    expect(constantlyFlips.status).toBe('QUARANTINED');
  });

  it('returns a zero-value computation for an empty run window', () => {
    const result = computeFlakinessScore([], BASE_CONFIG);

    expect(result).toMatchObject({
      runsConsidered: 0,
      flips: 0,
      flipRate: 0,
      confidenceScore: 0,
      status: 'STABLE',
    });
  });
});
