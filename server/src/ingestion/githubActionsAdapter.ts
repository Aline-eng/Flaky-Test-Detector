import AdmZip from 'adm-zip';
import { logger } from '../lib/logger';
import { parseJunitXml } from './junitParser';
import type {
  CiProviderAdapter,
  FetchRunsParams,
  GithubApiClient,
  NormalizedJobRun,
  NormalizedTestResult,
  TestStatus,
} from './types';

const JUNIT_ARTIFACT_NAME_PATTERN = /junit|test-results|test-report/i;
const JUNIT_XML_ENTRY_PATTERN = /\.xml$/i;
const PAGE_SIZE = 100;

type WorkflowRun = Awaited<
  ReturnType<GithubApiClient['listWorkflowRunsForRepo']>
>['data']['workflow_runs'][number];

type WorkflowJob = Awaited<
  ReturnType<GithubApiClient['listJobsForWorkflowRun']>
>['data']['jobs'][number];

type WorkflowArtifact = Awaited<
  ReturnType<GithubApiClient['listWorkflowRunArtifacts']>
>['data']['artifacts'][number];

function toTestStatus(conclusion: string | null): TestStatus {
  switch (conclusion) {
    case 'success':
      return 'passed';
    case 'failure':
      return 'failed';
    case 'skipped':
    case 'neutral':
      return 'skipped';
    default:
      // cancelled, timed_out, action_required, stale, startup_failure, or null (still running)
      return 'errored';
  }
}

function sanitizeForMatching(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export class GithubActionsAdapter implements CiProviderAdapter {
  constructor(private readonly octokit: GithubApiClient) {}

  async *fetchRunsSince(params: FetchRunsParams): AsyncGenerator<NormalizedJobRun> {
    const { owner, repo, sinceRunId, maxRuns } = params;
    const runs = await this.collectRunsSince(owner, repo, sinceRunId, maxRuns);

    for (const run of runs) {
      const jobs = await this.listAllJobs(owner, repo, run.id);
      const junitCandidates = await this.listJunitCandidateArtifacts(owner, repo, run.id);

      for (const job of jobs) {
        const testResults = await this.tryFetchJunitResultsForJob(
          owner,
          repo,
          job,
          junitCandidates,
          jobs.length,
        );

        yield this.toNormalizedJobRun(run, job, testResults);
      }
    }
  }

  private toNormalizedJobRun(
    run: WorkflowRun,
    job: WorkflowJob,
    testResults: NormalizedTestResult[] | undefined,
  ): NormalizedJobRun {
    const durationMs =
      job.started_at && job.completed_at
        ? new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()
        : undefined;

    return {
      workflowRunId: BigInt(run.id),
      jobId: BigInt(job.id),
      jobName: job.name,
      workflowName: run.name ?? 'unknown-workflow',
      commitSha: run.head_sha,
      branch: run.head_branch ?? 'unknown',
      startedAt: new Date(job.started_at),
      runnerOs: job.labels?.[0],
      isRetry: (run.run_attempt ?? 1) > 1,
      status: toTestStatus(job.conclusion),
      durationMs,
      errorMessage: job.conclusion === 'failure' ? `Job "${job.name}" failed` : undefined,
      testResults,
    };
  }

  /** Fetches workflow runs newest-first, stopping once we reach an already-seen run id. */
  private async collectRunsSince(
    owner: string,
    repo: string,
    sinceRunId: bigint | null,
    maxRuns: number,
  ): Promise<WorkflowRun[]> {
    const collected: WorkflowRun[] = [];
    let page = 1;

    while (collected.length < maxRuns) {
      const { data } = await this.octokit.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: PAGE_SIZE,
        page,
      });

      if (data.workflow_runs.length === 0) break;

      for (const run of data.workflow_runs) {
        if (sinceRunId !== null && BigInt(run.id) <= sinceRunId) {
          return collected;
        }
        collected.push(run);
        if (collected.length >= maxRuns) break;
      }

      if (data.workflow_runs.length < PAGE_SIZE) break;
      page += 1;
    }

    return collected;
  }

  private async listAllJobs(owner: string, repo: string, runId: number): Promise<WorkflowJob[]> {
    const jobs: WorkflowJob[] = [];
    let page = 1;

    for (;;) {
      const { data } = await this.octokit.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: runId,
        per_page: PAGE_SIZE,
        page,
      });
      jobs.push(...data.jobs);
      if (data.jobs.length < PAGE_SIZE) break;
      page += 1;
    }

    return jobs;
  }

  private async listJunitCandidateArtifacts(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<WorkflowArtifact[]> {
    try {
      const { data } = await this.octokit.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: runId,
        per_page: PAGE_SIZE,
      });
      return data.artifacts.filter((a) => !a.expired && JUNIT_ARTIFACT_NAME_PATTERN.test(a.name));
    } catch (err) {
      logger.warn({ err, owner, repo, runId }, 'failed to list workflow run artifacts');
      return [];
    }
  }

  /**
   * Artifacts aren't reliably scoped to one job in the GitHub API, so we match a candidate
   * artifact to a job by name (common pattern: an artifact named after its matrix leg, e.g.
   * "junit-results-ubuntu-node20"). If there's exactly one job and exactly one JUnit-shaped
   * artifact in the run, we attribute it to that sole job even without a name match. Otherwise
   * we deliberately fall back to job-level for that job rather than risk attributing the wrong
   * artifact's results to it.
   */
  private async tryFetchJunitResultsForJob(
    owner: string,
    repo: string,
    job: WorkflowJob,
    candidates: WorkflowArtifact[],
    totalJobsInRun: number,
  ): Promise<NormalizedTestResult[] | undefined> {
    if (candidates.length === 0) return undefined;

    const jobKey = sanitizeForMatching(job.name);
    let match = candidates.find((a) => sanitizeForMatching(a.name).includes(jobKey));

    if (!match && totalJobsInRun === 1 && candidates.length === 1) {
      match = candidates[0];
    }

    if (!match) return undefined;

    return this.downloadAndParseJunitArtifact(owner, repo, match.id);
  }

  private async downloadAndParseJunitArtifact(
    owner: string,
    repo: string,
    artifactId: number,
  ): Promise<NormalizedTestResult[] | undefined> {
    try {
      const download = await this.octokit.downloadArtifact({
        owner,
        repo,
        artifact_id: artifactId,
        archive_format: 'zip',
      });

      const zip = new AdmZip(Buffer.from(download.data as ArrayBuffer));
      const xmlEntries = zip.getEntries().filter((e) => JUNIT_XML_ENTRY_PATTERN.test(e.entryName));
      const results = xmlEntries.flatMap((entry) =>
        parseJunitXml(entry.getData().toString('utf-8')),
      );

      return results.length > 0 ? results : undefined;
    } catch (err) {
      logger.warn(
        { err, owner, repo, artifactId },
        'failed to download/parse JUnit artifact, falling back to job-level for this job',
      );
      return undefined;
    }
  }
}
