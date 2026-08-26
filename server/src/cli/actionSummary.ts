import type { FlakinessStatus } from '../detection/types';

export interface ScoredTestSummary {
  name: string;
  suite: string;
  quarantineStatus: FlakinessStatus;
  confidenceScore: number | null;
}

export interface ActionSummary {
  markdown: string;
  quarantinedCount: number;
  flaggedCount: number;
}

/**
 * Builds the GitHub Actions job summary markdown (written to $GITHUB_STEP_SUMMARY) and the
 * counts written to $GITHUB_OUTPUT, from a repo's freshly-scored tests.
 */
export function buildActionSummary(repo: string, tests: ScoredTestSummary[]): ActionSummary {
  const quarantined = tests.filter((t) => t.quarantineStatus === 'QUARANTINED');
  const flagged = tests.filter((t) => t.quarantineStatus === 'FLAGGED');

  const lines = [
    '## Flaky Test Detector',
    '',
    `Scored **${tests.length}** test${tests.length === 1 ? '' : 's'} for \`${repo}\`.`,
    `- Quarantined: **${quarantined.length}**`,
    `- Flagged: **${flagged.length}**`,
  ];

  if (quarantined.length > 0) {
    lines.push(
      '',
      '### Quarantined tests',
      '',
      '| Test | Suite | Confidence |',
      '| --- | --- | --- |',
    );
    for (const t of quarantined) {
      lines.push(`| ${t.name} | ${t.suite} | ${t.confidenceScore?.toFixed(3) ?? '—'} |`);
    }
  }

  return {
    markdown: `${lines.join('\n')}\n`,
    quarantinedCount: quarantined.length,
    flaggedCount: flagged.length,
  };
}
