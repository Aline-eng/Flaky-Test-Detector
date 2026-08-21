import { wilsonScoreInterval } from '../wilsonScore';

describe('wilsonScoreInterval', () => {
  it('matches the textbook 95% Wilson lower bound for 1 success out of 1 trial (~0.2065)', () => {
    const { lowerBound, upperBound } = wilsonScoreInterval(1, 1);
    expect(lowerBound).toBeCloseTo(0.2065, 3);
    expect(upperBound).toBeCloseTo(1, 3);
  });

  it('matches the textbook 95% Wilson interval for 0 successes out of 10 trials (~0 to ~0.2776)', () => {
    const { lowerBound, upperBound } = wilsonScoreInterval(0, 10);
    expect(lowerBound).toBeCloseTo(0, 3);
    expect(upperBound).toBeCloseTo(0.2776, 3);
  });

  it('returns a zero-width interval at zero when there are no trials', () => {
    expect(wilsonScoreInterval(0, 0)).toEqual({ lowerBound: 0, upperBound: 0, center: 0 });
  });

  it('produces a much tighter, higher-confidence interval as trials grow for the same ratio', () => {
    const small = wilsonScoreInterval(5, 10); // 50% out of 10
    const large = wilsonScoreInterval(50, 100); // 50% out of 100

    expect(small.upperBound - small.lowerBound).toBeGreaterThan(
      large.upperBound - large.lowerBound,
    );
    // Same naive ratio, but the small-sample lower bound is more conservative (lower).
    expect(small.lowerBound).toBeLessThan(large.lowerBound);
  });

  it('never returns bounds outside [0, 1]', () => {
    const { lowerBound, upperBound } = wilsonScoreInterval(100, 100);
    expect(lowerBound).toBeGreaterThanOrEqual(0);
    expect(upperBound).toBeLessThanOrEqual(1);
  });
});
