export type RunOutcome = 'pass' | 'fail';

/**
 * Counts pass<->fail transitions in chronological order. Callers must already have filtered
 * out SKIPPED runs — a skip carries no pass/fail signal and shouldn't count as a "same" or
 * "different" outcome relative to its neighbors.
 */
export function countFlips(outcomes: RunOutcome[]): number {
  let flips = 0;
  for (let i = 1; i < outcomes.length; i += 1) {
    if (outcomes[i] !== outcomes[i - 1]) flips += 1;
  }
  return flips;
}
