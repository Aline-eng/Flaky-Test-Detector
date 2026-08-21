import type { Octokit } from '@octokit/rest';

export type TestStatus = 'passed' | 'failed' | 'errored' | 'skipped';

export interface NormalizedTestResult {
  suite: string;
  name: string;
  filePath?: string;
  status: TestStatus;
  durationMs?: number;
  errorMessage?: string;
}

export interface NormalizedJobRun {
  workflowRunId: bigint;
  jobId: bigint;
  jobName: string;
  workflowName: string;
  commitSha: string;
  branch: string;
  startedAt: Date;
  runnerOs?: string;
  isRetry: boolean;
  status: TestStatus;
  durationMs?: number;
  errorMessage?: string;
  /** Present only when a JUnit XML artifact could be attributed to this specific job. */
  testResults?: NormalizedTestResult[];
}

export interface FetchRunsParams {
  owner: string;
  repo: string;
  sinceRunId: bigint | null;
  maxRuns: number;
}

/**
 * Adapter boundary for a CI provider. GitHub Actions is the only v1 implementation; a future
 * provider (CircleCI, GitLab CI, ...) would implement this same interface without touching
 * the detection/quarantine layers downstream.
 */
export interface CiProviderAdapter {
  fetchRunsSince(params: FetchRunsParams): AsyncGenerator<NormalizedJobRun>;
}

/** Narrow slice of Octokit's REST surface that the GitHub Actions adapter actually calls. */
export type GithubApiClient = Pick<
  Octokit['rest']['actions'],
  | 'listWorkflowRunsForRepo'
  | 'listJobsForWorkflowRun'
  | 'listWorkflowRunArtifacts'
  | 'downloadArtifact'
>;
