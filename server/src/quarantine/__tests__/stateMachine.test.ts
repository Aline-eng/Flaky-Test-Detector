import { decideQuarantineTransition } from '../stateMachine';

describe('decideQuarantineTransition', () => {
  it('does nothing when the detected status matches the current status', () => {
    expect(decideQuarantineTransition('STABLE', 'STABLE', 0, 10)).toBeNull();
    expect(decideQuarantineTransition('FLAGGED', 'FLAGGED', 0, 10)).toBeNull();
  });

  it('transitions STABLE -> FLAGGED when detection flags the test', () => {
    const result = decideQuarantineTransition('STABLE', 'FLAGGED', 0, 10);
    expect(result).toEqual({
      toStatus: 'FLAGGED',
      reason: 'flakiness detection classified this test as FLAGGED',
    });
  });

  it('transitions FLAGGED -> QUARANTINED when detection escalates', () => {
    const result = decideQuarantineTransition('FLAGGED', 'QUARANTINED', 0, 10);
    expect(result?.toStatus).toBe('QUARANTINED');
  });

  it('transitions FLAGGED -> STABLE when detection recovers (not yet quarantined)', () => {
    const result = decideQuarantineTransition('FLAGGED', 'STABLE', 0, 10);
    expect(result?.toStatus).toBe('STABLE');
  });

  it('can jump straight from STABLE to QUARANTINED if detection is severe enough', () => {
    const result = decideQuarantineTransition('STABLE', 'QUARANTINED', 0, 10);
    expect(result?.toStatus).toBe('QUARANTINED');
  });

  it('ignores the detected status entirely while quarantined, below the clean-run threshold', () => {
    // Even if detection says STABLE now, a momentary dip shouldn't promote out of quarantine.
    const result = decideQuarantineTransition('QUARANTINED', 'STABLE', 9, 10);
    expect(result).toBeNull();
  });

  it('auto-promotes QUARANTINED -> STABLE once the clean-run requirement is met', () => {
    const result = decideQuarantineTransition('QUARANTINED', 'FLAGGED', 10, 10);
    expect(result).toEqual({
      toStatus: 'STABLE',
      reason: '10 consecutive clean runs since quarantine (required 10)',
    });
  });

  it('auto-promotes even past the exact requirement', () => {
    const result = decideQuarantineTransition('QUARANTINED', 'QUARANTINED', 15, 10);
    expect(result?.toStatus).toBe('STABLE');
  });
});
