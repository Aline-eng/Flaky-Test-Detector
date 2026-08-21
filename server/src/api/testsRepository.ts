import type { FlakinessStatus, PrismaClient, TestRunStatus } from '@prisma/client';

export interface ScoreSummary {
  status: FlakinessStatus;
  confidenceScore: number;
  flipRate: number;
  computedAt: Date;
}

export interface QuarantineEventSummary {
  transitionedTo: FlakinessStatus;
  reason: string;
  occurredAt: Date;
}

export interface RunSummary {
  status: TestRunStatus;
  startedAt: Date;
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
  firstSeenAt: Date;
  runs: RunSummary[];
  scoreHistory: ScoreSummary[];
  quarantineHistory: QuarantineEventSummary[];
}

export interface TestsRepository {
  listTests(repo: string): Promise<TestListItem[]>;
  getTestDetail(testId: string): Promise<TestDetail | null>;
  /** Returns false if the test doesn't exist. */
  recordManualOverride(testId: string, status: FlakinessStatus, reason: string): Promise<boolean>;
}

function toScoreSummary(score: {
  status: FlakinessStatus;
  confidenceScore: number;
  flipRate: number;
  computedAt: Date;
}): ScoreSummary {
  return {
    status: score.status,
    confidenceScore: score.confidenceScore,
    flipRate: score.flipRate,
    computedAt: score.computedAt,
  };
}

export class PrismaTestsRepository implements TestsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listTests(repo: string): Promise<TestListItem[]> {
    const tests = await this.prisma.test.findMany({
      where: { repo },
      include: {
        scores: { orderBy: { computedAt: 'desc' }, take: 1 },
        quarantineEvents: { orderBy: { occurredAt: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });

    return tests.map((t) => ({
      id: t.id,
      repo: t.repo,
      suite: t.suite,
      name: t.name,
      latestScore: t.scores[0] ? toScoreSummary(t.scores[0]) : null,
      quarantineStatus: t.quarantineEvents[0]?.transitionedTo ?? 'STABLE',
    }));
  }

  async getTestDetail(testId: string): Promise<TestDetail | null> {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        runs: { orderBy: { startedAt: 'desc' }, take: 200 },
        scores: { orderBy: { computedAt: 'desc' }, take: 100 },
        quarantineEvents: { orderBy: { occurredAt: 'desc' } },
      },
    });

    if (!test) return null;

    return {
      id: test.id,
      repo: test.repo,
      suite: test.suite,
      name: test.name,
      filePath: test.filePath,
      firstSeenAt: test.firstSeenAt,
      latestScore: test.scores[0] ? toScoreSummary(test.scores[0]) : null,
      quarantineStatus: test.quarantineEvents[0]?.transitionedTo ?? 'STABLE',
      runs: test.runs.map((r) => ({
        status: r.status,
        startedAt: r.startedAt,
        durationMs: r.durationMs,
        branch: r.branch,
        commitSha: r.commitSha,
      })),
      scoreHistory: test.scores.map(toScoreSummary),
      quarantineHistory: test.quarantineEvents.map((q) => ({
        transitionedTo: q.transitionedTo,
        reason: q.reason,
        occurredAt: q.occurredAt,
      })),
    };
  }

  async recordManualOverride(
    testId: string,
    status: FlakinessStatus,
    reason: string,
  ): Promise<boolean> {
    const test = await this.prisma.test.findUnique({ where: { id: testId }, select: { id: true } });
    if (!test) return false;

    await this.prisma.quarantineEvent.create({
      data: { testId, transitionedTo: status, reason: `manual override: ${reason}` },
    });
    return true;
  }
}
