import type { FlakinessStatus } from '../detection/types';
import type { QuarantineStatus, QuarantineTransition } from './types';

/**
 * Decides whether a test's quarantine status should change, given its current status, the
 * detection engine's freshly computed classification, and (only relevant while quarantined)
 * how many consecutive clean runs have occurred since quarantine began.
 *
 * While NOT quarantined, status simply tracks the detection engine's classification, and a
 * QuarantineEvent is recorded only on an actual change (this is what keeps notifications from
 * firing on every ingestion re-run — see applyQuarantineTransitions).
 *
 * Once QUARANTINED, the flip-rate-based classification is deliberately ignored for demotion:
 * only sustained clean runs (cleanRunsRequired in a row) can promote a test back to STABLE.
 * A momentary dip in the score is not enough on its own — see
 * docs/adr/0003-quarantine-auto-promotion.md for why.
 */
export function decideQuarantineTransition(
  currentStatus: QuarantineStatus,
  detectedStatus: FlakinessStatus,
  consecutiveCleanRuns: number,
  cleanRunsRequired: number,
): QuarantineTransition | null {
  if (currentStatus === 'QUARANTINED') {
    if (consecutiveCleanRuns >= cleanRunsRequired) {
      return {
        toStatus: 'STABLE',
        reason: `${consecutiveCleanRuns} consecutive clean runs since quarantine (required ${cleanRunsRequired})`,
      };
    }
    return null;
  }

  if (detectedStatus === currentStatus) {
    return null;
  }

  return {
    toStatus: detectedStatus,
    reason: `flakiness detection classified this test as ${detectedStatus}`,
  };
}
