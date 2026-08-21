export interface WilsonInterval {
  lowerBound: number;
  upperBound: number;
  center: number;
}

/**
 * Wilson score confidence interval for a binomial proportion (successes out of trials), at
 * the given z critical value (default 1.96 ≈ 95% confidence).
 *
 * Unlike a raw percentage, this widens correctly for small sample sizes: 1 flip out of 2
 * runs and 25 flips out of 50 runs are both "50%" as a naive ratio, but the former is far
 * less trustworthy. See docs/adr/0001-wilson-score-confidence-intervals.md.
 */
export function wilsonScoreInterval(successes: number, trials: number, z = 1.96): WilsonInterval {
  if (trials <= 0) {
    return { lowerBound: 0, upperBound: 0, center: 0 };
  }

  const phat = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (phat + z2 / (2 * trials)) / denominator;
  const margin =
    (z / denominator) * Math.sqrt((phat * (1 - phat)) / trials + z2 / (4 * trials * trials));

  return {
    lowerBound: Math.max(0, center - margin),
    upperBound: Math.min(1, center + margin),
    center,
  };
}
