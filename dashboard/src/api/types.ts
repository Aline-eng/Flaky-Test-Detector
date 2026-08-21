export type FlakinessStatus = 'STABLE' | 'FLAGGED' | 'QUARANTINED';
export type TestRunStatus = 'PASSED' | 'FAILED' | 'ERRORED' | 'SKIPPED';

export interface ScoreSummary {
  status: FlakinessStatus;
  confidenceScore: number;
  flipRate: number;
  computedAt: string;
}

export interface QuarantineEventSummary {
  transitionedTo: FlakinessStatus;
  reason: string;
  occurredAt: string;
}

export interface RunSummary {
  status: TestRunStatus;
  startedAt: string;
  durationMs: number | null;
  branch: string;
  commitSha: string;
}

export interface TestListItem {
  id: string;
  repo: string;
  suite: string;
  name: string;
  latestScore: ScoreSummary | null;
  quarantineStatus: FlakinessStatus;
}

export interface TestDetail extends TestListItem {
  filePath: string | null;
  firstSeenAt: string;
  runs: RunSummary[];
  scoreHistory: ScoreSummary[];
  quarantineHistory: QuarantineEventSummary[];
}
