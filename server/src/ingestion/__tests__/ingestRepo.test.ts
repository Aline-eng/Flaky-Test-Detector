import AdmZip from 'adm-zip';
import type { IngestionMode, TestRunStatus } from '@prisma/client';
import { GithubActionsAdapter } from '../githubActionsAdapter';
import { ingestRepo, type IngestionStore } from '../ingestRepo';
import type { GithubApiClient } from '../types';

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');

interface FakeTestRow {
  id: string;
  repo: string;
  suite: string;
  name: string;
  filePath: string | null;
}

interface FakeTestRunRow {
  id: string;
  testId: string;
  workflowRunId: bigint;
  jobId: bigint;
  status: TestRunStatus;
}

function createFakeStore(): IngestionStore & {
  tests: Map<string, FakeTestRow>;
  testRuns: Map<string, FakeTestRunRow>;
  cursors: Map<string, { lastRunIdSeen: bigint | null; ingestionMode: IngestionMode | null }>;
} {
  const tests = new Map<string, FakeTestRow>();
  const testRuns = new Map<string, FakeTestRunRow>();
  const cursors = new Map<
    string,
    { lastRunIdSeen: bigint | null; ingestionMode: IngestionMode | null }
  >();
  let nextId = 1;

  return {
    tests,
    testRuns,
    cursors,
    test: {
      async upsert({ where, create }) {
        const key = `${where.repo_suite_name.repo}|${where.repo_suite_name.suite}|${where.repo_suite_name.name}`;
        const existing = tests.get(key);
        if (existing) return existing;
        const row = { id: `test-${nextId++}`, ...create };
        tests.set(key, row);
        return row;
      },
    },
    testRun: {
      async upsert({ where, create }) {
        const k = where.testId_workflowRunId_jobId;
        const key = `${k.testId}|${k.workflowRunId}|${k.jobId}`;
        const existing = testRuns.get(key);
        if (existing) return existing;
        const row = {
          id: `run-${nextId++}`,
          testId: create.testId,
          workflowRunId: create.workflowRunId,
          jobId: create.jobId,
          status: create.status,
        };
        testRuns.set(key, row);
        return row;
      },
    },
    ingestionCursor: {
      async findUnique({ where }) {
        return cursors.get(where.repo) ?? null;
      },
      async upsert({ where, create, update }) {
        const value = cursors.has(where.repo) ? update : create;
        cursors.set(where.repo, value);
        return value;
      },
    },
  };
}

function zipWithJunitXml(xml: string): Buffer {
  const zip = new AdmZip();
  zip.addFile('report.xml', Buffer.from(xml, 'utf-8'));
  return zip.toBuffer();
}

describe('ingestRepo (integration, mocked Octokit)', () => {
  it('ingests job-level results when no repo publishes JUnit XML artifacts', async () => {
    const octokit: GithubApiClient = {
      listWorkflowRunsForRepo: jest.fn().mockResolvedValue({
        data: {
          workflow_runs: [
            { id: 101, name: 'Tests', head_sha: 'abc123', head_branch: 'main', run_attempt: 1 },
            { id: 100, name: 'Tests', head_sha: 'abc000', head_branch: 'main', run_attempt: 1 },
          ],
        },
      }),
      listJobsForWorkflowRun: jest.fn().mockImplementation(({ run_id }) => ({
        data: {
          jobs: [
            {
              id: run_id * 10 + 1,
              name: 'mysql-node-20-linux',
              conclusion: run_id === 101 ? 'failure' : 'success',
              started_at: '2026-01-01T00:00:00.000Z',
              completed_at: '2026-01-01T00:05:00.000Z',
              labels: ['ubuntu-latest'],
            },
          ],
        },
      })),
      listWorkflowRunArtifacts: jest.fn().mockResolvedValue({ data: { artifacts: [] } }),
      downloadArtifact: jest.fn(),
    } as unknown as GithubApiClient;

    const store = createFakeStore();
    const adapter = new GithubActionsAdapter(octokit);

    const result = await ingestRepo(store, adapter, {
      owner: 'typeorm',
      repo: 'typeorm',
      now: () => FIXED_NOW,
    });

    expect(result).toEqual({ runsProcessed: 2, testRunsProcessed: 2, mode: 'JOB_LEVEL' });
    expect(store.tests.size).toBe(1); // same job name across both runs -> one Test row
    expect(store.testRuns.size).toBe(2); // one TestRun row per run/job combination
  });

  it('does not create duplicate TestRun rows when the same runs are ingested twice', async () => {
    const octokit: GithubApiClient = {
      listWorkflowRunsForRepo: jest.fn().mockResolvedValue({
        data: { workflow_runs: [{ id: 5, name: 'Tests', head_sha: 'sha5', head_branch: 'main' }] },
      }),
      listJobsForWorkflowRun: jest.fn().mockResolvedValue({
        data: {
          jobs: [
            {
              id: 50,
              name: 'lint',
              conclusion: 'success',
              started_at: '2026-01-01T00:00:00.000Z',
              completed_at: '2026-01-01T00:01:00.000Z',
              labels: ['ubuntu-latest'],
            },
          ],
        },
      }),
      listWorkflowRunArtifacts: jest.fn().mockResolvedValue({ data: { artifacts: [] } }),
      downloadArtifact: jest.fn(),
    } as unknown as GithubApiClient;

    const store = createFakeStore();
    const adapter = new GithubActionsAdapter(octokit);

    await ingestRepo(store, adapter, { owner: 'o', repo: 'r', now: () => FIXED_NOW });
    expect(store.testRuns.size).toBe(1);

    // Re-run against the same fixed run/job data with the cursor already advanced: the
    // adapter should skip the already-seen run entirely.
    const second = await ingestRepo(store, adapter, {
      owner: 'o',
      repo: 'r',
      now: () => FIXED_NOW,
    });
    expect(second.runsProcessed).toBe(0);
    expect(store.testRuns.size).toBe(1);

    // Even if the cursor were reset (e.g. a fresh backfill), the unique-key upsert must
    // still prevent duplicates.
    store.cursors.delete('o/r');
    const third = await ingestRepo(store, adapter, { owner: 'o', repo: 'r', now: () => FIXED_NOW });
    expect(third.runsProcessed).toBe(1);
    expect(store.testRuns.size).toBe(1);
  });

  it('ingests per-test results when a job has a matching JUnit XML artifact', async () => {
    const junitXml = `<testsuite name="UserRepository">
      <testcase classname="test/user.test.ts" name="creates a user" time="0.1" />
      <testcase classname="test/user.test.ts" name="rejects duplicates" time="0.2">
        <failure message="boom">boom</failure>
      </testcase>
    </testsuite>`;

    const octokit: GithubApiClient = {
      listWorkflowRunsForRepo: jest.fn().mockResolvedValue({
        data: { workflow_runs: [{ id: 7, name: 'Tests', head_sha: 'sha7', head_branch: 'main' }] },
      }),
      listJobsForWorkflowRun: jest.fn().mockResolvedValue({
        data: {
          jobs: [
            {
              id: 70,
              name: 'unit-tests',
              conclusion: 'failure',
              started_at: '2026-01-01T00:00:00.000Z',
              completed_at: '2026-01-01T00:02:00.000Z',
              labels: ['ubuntu-latest'],
            },
          ],
        },
      }),
      listWorkflowRunArtifacts: jest.fn().mockResolvedValue({
        data: { artifacts: [{ id: 999, name: 'junit-unit-tests', expired: false }] },
      }),
      downloadArtifact: jest.fn().mockResolvedValue({ data: zipWithJunitXml(junitXml) }),
    } as unknown as GithubApiClient;

    const store = createFakeStore();
    const adapter = new GithubActionsAdapter(octokit);

    const result = await ingestRepo(store, adapter, {
      owner: 'o',
      repo: 'r',
      now: () => FIXED_NOW,
    });

    expect(result.mode).toBe('JUNIT_XML');
    expect(result.testRunsProcessed).toBe(2);
    expect(store.tests.size).toBe(2);

    const failedRow = [...store.testRuns.values()].find((r) => r.status === 'FAILED');
    expect(failedRow).toBeDefined();
  });
});
