import { buildActionSummary } from '../actionSummary';

describe('buildActionSummary', () => {
  it('reports zero counts and no table when nothing is flagged or quarantined', () => {
    const result = buildActionSummary('o/r', [
      { name: 'a', suite: 'unit', quarantineStatus: 'STABLE', confidenceScore: 0.01 },
    ]);

    expect(result.quarantinedCount).toBe(0);
    expect(result.flaggedCount).toBe(0);
    expect(result.markdown).toContain('Scored **1** test for `o/r`');
    expect(result.markdown).not.toContain('Quarantined tests');
  });

  it('pluralizes "tests" correctly', () => {
    const result = buildActionSummary('o/r', [
      { name: 'a', suite: 'unit', quarantineStatus: 'STABLE', confidenceScore: 0 },
      { name: 'b', suite: 'unit', quarantineStatus: 'STABLE', confidenceScore: 0 },
    ]);

    expect(result.markdown).toContain('Scored **2** tests for `o/r`');
  });

  it('lists quarantined tests in a markdown table with their confidence score', () => {
    const result = buildActionSummary('o/r', [
      { name: 'flaky it', suite: 'unit', quarantineStatus: 'QUARANTINED', confidenceScore: 0.42 },
      { name: 'stable it', suite: 'unit', quarantineStatus: 'STABLE', confidenceScore: 0.01 },
      { name: 'watch it', suite: 'unit', quarantineStatus: 'FLAGGED', confidenceScore: 0.2 },
    ]);

    expect(result.quarantinedCount).toBe(1);
    expect(result.flaggedCount).toBe(1);
    expect(result.markdown).toContain('### Quarantined tests');
    expect(result.markdown).toContain('| flaky it | unit | 0.420 |');
    expect(result.markdown).not.toContain('stable it');
    expect(result.markdown).not.toContain('watch it');
  });

  it('falls back to an em dash when a quarantined test has no score yet', () => {
    const result = buildActionSummary('o/r', [
      { name: 'flaky it', suite: 'unit', quarantineStatus: 'QUARANTINED', confidenceScore: null },
    ]);

    expect(result.markdown).toContain('| flaky it | unit | — |');
  });
});
