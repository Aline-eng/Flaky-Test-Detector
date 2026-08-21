import type { IngestionMode, TestRunStatus } from '@prisma/client';
import { logger } from '../lib/logger';
import type { CiProviderAdapter, NormalizedJobRun, TestStatus } from './types';

const DEFAULT_MAX_RUNS = 300;

/** Narrow persistence boundary the orchestrator needs — satisfied by PrismaClient in
 *  production and by a lightweight in-memory fake in tests. */
export interface IngestionStore {
  test: {
    upsert(args: {
      where: { repo_suite_name: { repo: string; suite: string; name: string } };
      create: { repo: string; suite: string; name: string; filePath: string | null };
      update: Record<string, never>;
    }): Promise<{ id: string }>;
  };
  testRun: {
    upsert(args: {
      where: {
        testId_workflowRunId_jobId: { testId: string; workflowRunId: bigint; jobId: bigint };
      };
      create: {
        testId: string;
        workflowRunId: bigint;
        jobId: bigint;
        commitSha: string;
        branch: string;
        status: TestRunStatus;
        durationMs: number | null;
        errorMessage: string | null;
        startedAt: Date;
        runnerOs: string | null;
        isRetry: boolean;
      };
      update: Record<string, never>;
    }): Promise<{ id: string }>;
  };
  ingestionCursor: {
    findUnique(args: {
      where: { repo: string };
    }): Promise<{ lastRunIdSeen: bigint | null; ingestionMode: IngestionMode | null } | null>;
    upsert(args: {
      where: { repo: string };
      create: {
        repo: string;
        lastRunIdSeen: bigint | null;
        lastSyncedAt: Date;
        ingestionMode: IngestionMode | null;
      };
      update: {
        lastRunIdSeen: bigint | null;
        lastSyncedAt: Date;
        ingestionMode: IngestionMode | null;
      };
    }): Promise<unknown>;
  };
}

export interface IngestOptions {
  owner: string;
  repo: string;
  maxRuns?: number;
  now?: () => Date;
}

export interface IngestResult {
  runsProcessed: number;
  testRunsProcessed: number;
  mode: IngestionMode | null;
}

const STATUS_MAP: Record<TestStatus, TestRunStatus> = {
  passed: 'PASSED',
  failed: 'FAILED',
  errored: 'ERRORED',
  skipped: 'SKIPPED',
};

export async function ingestRepo(
  store: IngestionStore,
  adapter: CiProviderAdapter,
  options: IngestOptions,
): Promise<IngestResult> {
  const repoKey = `${options.owner}/${options.repo}`;
  const now = options.now ?? (() => new Date());
  const cursor = await store.ingestionCursor.findUnique({ where: { repo: repoKey } });

  let runsProcessed = 0;
  let testRunsProcessed = 0;
  let maxRunIdSeen = cursor?.lastRunIdSeen ?? null;
  let mode: IngestionMode | null = cursor?.ingestionMode ?? null;
  const runIdsSeen = new Set<string>();

  for await (const jobRun of adapter.fetchRunsSince({
    owner: options.owner,
    repo: options.repo,
    sinceRunId: cursor?.lastRunIdSeen ?? null,
    maxRuns: options.maxRuns ?? DEFAULT_MAX_RUNS,
  })) {
    if (!runIdsSeen.has(jobRun.workflowRunId.toString())) {
      runIdsSeen.add(jobRun.workflowRunId.toString());
      runsProcessed += 1;
    }

    const hasPerTestResults = (jobRun.testResults?.length ?? 0) > 0;
    if (mode === null) {
      mode = hasPerTestResults ? 'JUNIT_XML' : 'JOB_LEVEL';
      logger.info({ repo: repoKey, mode }, 'ingestion mode detected for this repo');
    }

    if (hasPerTestResults) {
      for (const result of jobRun.testResults!) {
        await upsertTestRun(store, repoKey, jobRun, {
          suite: result.suite,
          name: result.name,
          filePath: result.filePath,
          status: result.status,
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
        });
        testRunsProcessed += 1;
      }
    } else {
      await upsertTestRun(store, repoKey, jobRun, {
        suite: jobRun.workflowName,
        name: jobRun.jobName,
        status: jobRun.status,
        durationMs: jobRun.durationMs,
        errorMessage: jobRun.errorMessage,
      });
      testRunsProcessed += 1;
    }

    if (maxRunIdSeen === null || jobRun.workflowRunId > maxRunIdSeen) {
      maxRunIdSeen = jobRun.workflowRunId;
    }
  }

  await store.ingestionCursor.upsert({
    where: { repo: repoKey },
    create: {
      repo: repoKey,
      lastRunIdSeen: maxRunIdSeen,
      lastSyncedAt: now(),
      ingestionMode: mode,
    },
    update: { lastRunIdSeen: maxRunIdSeen, lastSyncedAt: now(), ingestionMode: mode },
  });

  return { runsProcessed, testRunsProcessed, mode };
}

async function upsertTestRun(
  store: IngestionStore,
  repo: string,
  jobRun: NormalizedJobRun,
  test: {
    suite: string;
    name: string;
    filePath?: string;
    status: TestStatus;
    durationMs?: number;
    errorMessage?: string;
  },
): Promise<void> {
  const testRecord = await store.test.upsert({
    where: { repo_suite_name: { repo, suite: test.suite, name: test.name } },
    create: { repo, suite: test.suite, name: test.name, filePath: test.filePath ?? null },
    update: {},
  });

  await store.testRun.upsert({
    where: {
      testId_workflowRunId_jobId: {
        testId: testRecord.id,
        workflowRunId: jobRun.workflowRunId,
        jobId: jobRun.jobId,
      },
    },
    create: {
      testId: testRecord.id,
      workflowRunId: jobRun.workflowRunId,
      jobId: jobRun.jobId,
      commitSha: jobRun.commitSha,
      branch: jobRun.branch,
      status: STATUS_MAP[test.status],
      durationMs: test.durationMs ?? null,
      errorMessage: test.errorMessage ?? null,
      startedAt: jobRun.startedAt,
      runnerOs: jobRun.runnerOs ?? null,
      isRetry: jobRun.isRetry,
    },
    // Idempotent by design: a historical run's result never changes on re-ingestion.
    update: {},
  });
}
