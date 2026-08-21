import type { FlakinessStatus } from '../../detection/types';
import { applyQuarantineTransitions, type QuarantineStore } from '../applyQuarantineTransitions';
import type { QuarantineNotifier } from '../notifier';
import type { QuarantineStatus, QuarantineTransition, TestSummary } from '../types';

const TEST: TestSummary = { id: 'test-1', repo: 'o/r', suite: 'unit', name: 'flaky it' };

function createFakeStore(initial: {
  latestStatus: FlakinessStatus | null;
  quarantineState: { status: QuarantineStatus; since: Date };
  consecutiveCleanRuns?: number;
}): QuarantineStore & { events: QuarantineTransition[] } {
  const events: QuarantineTransition[] = [];
  let quarantineState = initial.quarantineState;

  return {
    events,
    async listTests() {
      return [TEST];
    },
    async getLatestFlakinessStatus() {
      return initial.latestStatus;
    },
    async getCurrentQuarantineState() {
      return quarantineState;
    },
    async countConsecutiveCleanRunsSince() {
      return initial.consecutiveCleanRuns ?? 0;
    },
    async recordTransition(_testId, transition) {
      events.push(transition);
      quarantineState = { status: transition.toStatus, since: new Date() };
    },
  };
}

function createFakeNotifier(): QuarantineNotifier & { calls: Array<{ reason: string }> } {
  const calls: Array<{ reason: string }> = [];
  return {
    calls,
    async notifyQuarantined(_test, reason) {
      calls.push({ reason });
    },
  };
}

describe('applyQuarantineTransitions', () => {
  it('skips a test that has never been scored', async () => {
    const store = createFakeStore({
      latestStatus: null,
      quarantineState: { status: 'STABLE', since: new Date(0) },
    });
    const notifier = createFakeNotifier();

    const summary = await applyQuarantineTransitions(store, notifier, {
      repo: 'o/r',
      cleanRunsRequired: 10,
    });

    expect(summary).toEqual({ testsEvaluated: 0, transitions: 0 });
    expect(notifier.calls).toHaveLength(0);
  });

  it('fires exactly one notification on transition into QUARANTINED', async () => {
    const store = createFakeStore({
      latestStatus: 'QUARANTINED',
      quarantineState: { status: 'FLAGGED', since: new Date(0) },
    });
    const notifier = createFakeNotifier();

    const summary = await applyQuarantineTransitions(store, notifier, {
      repo: 'o/r',
      cleanRunsRequired: 10,
    });

    expect(summary).toEqual({ testsEvaluated: 1, transitions: 1 });
    expect(store.events).toEqual([
      {
        toStatus: 'QUARANTINED',
        reason: 'flakiness detection classified this test as QUARANTINED',
      },
    ]);
    expect(notifier.calls).toHaveLength(1);
  });

  it('does not re-notify on a second run once already quarantined with the same detection result', async () => {
    const store = createFakeStore({
      latestStatus: 'QUARANTINED',
      quarantineState: { status: 'FLAGGED', since: new Date(0) },
    });
    const notifier = createFakeNotifier();

    await applyQuarantineTransitions(store, notifier, { repo: 'o/r', cleanRunsRequired: 10 });
    expect(notifier.calls).toHaveLength(1);

    // Second ingestion cycle: still QUARANTINED, detection still says QUARANTINED -- this is
    // exactly the "no repeat spam on every ingestion run" requirement.
    const second = await applyQuarantineTransitions(store, notifier, {
      repo: 'o/r',
      cleanRunsRequired: 10,
    });

    expect(second.transitions).toBe(0);
    expect(notifier.calls).toHaveLength(1);
  });

  it('does not notify on auto-promotion back to STABLE', async () => {
    const store = createFakeStore({
      latestStatus: 'FLAGGED',
      quarantineState: { status: 'QUARANTINED', since: new Date(0) },
      consecutiveCleanRuns: 10,
    });
    const notifier = createFakeNotifier();

    const summary = await applyQuarantineTransitions(store, notifier, {
      repo: 'o/r',
      cleanRunsRequired: 10,
    });

    expect(summary.transitions).toBe(1);
    expect(store.events[0].toStatus).toBe('STABLE');
    expect(notifier.calls).toHaveLength(0);
  });
});
