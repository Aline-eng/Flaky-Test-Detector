import type { PrismaClient } from '@prisma/client';
import type { FlakinessStatus } from '../detection/types';
import type { QuarantineStore } from './applyQuarantineTransitions';
import type { QuarantineStatus, QuarantineTransition, TestSummary } from './types';

export class PrismaQuarantineStore implements QuarantineStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listTests(repo: string): Promise<TestSummary[]> {
    return this.prisma.test.findMany({
      where: { repo },
      select: { id: true, repo: true, suite: true, name: true },
    });
  }

  async getLatestFlakinessStatus(testId: string): Promise<FlakinessStatus | null> {
    const latest = await this.prisma.flakinessScore.findFirst({
      where: { testId },
      orderBy: { computedAt: 'desc' },
      select: { status: true },
    });
    return latest?.status ?? null;
  }

  async getCurrentQuarantineState(
    testId: string,
  ): Promise<{ status: QuarantineStatus; since: Date }> {
    const latest = await this.prisma.quarantineEvent.findFirst({
      where: { testId },
      orderBy: { occurredAt: 'desc' },
    });

    if (!latest) {
      return { status: 'STABLE', since: new Date(0) };
    }
    return { status: latest.transitionedTo, since: latest.occurredAt };
  }

  async countConsecutiveCleanRunsSince(testId: string, since: Date): Promise<number> {
    const runs = await this.prisma.testRun.findMany({
      where: { testId, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      select: { status: true },
    });

    let count = 0;
    for (const run of runs) {
      if (run.status === 'SKIPPED') continue;
      if (run.status !== 'PASSED') break;
      count += 1;
    }
    return count;
  }

  async recordTransition(testId: string, transition: QuarantineTransition): Promise<void> {
    await this.prisma.quarantineEvent.create({
      data: { testId, transitionedTo: transition.toStatus, reason: transition.reason },
    });
  }
}
