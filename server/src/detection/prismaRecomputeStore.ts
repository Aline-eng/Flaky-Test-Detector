import type { PrismaClient } from '@prisma/client';
import type { RecomputeStore } from './recompute';
import type { FlakinessComputation, ScorableRun } from './types';

export class PrismaRecomputeStore implements RecomputeStore {
  constructor(private readonly prisma: PrismaClient) {}

  async listTestIds(repo: string): Promise<string[]> {
    const tests = await this.prisma.test.findMany({ where: { repo }, select: { id: true } });
    return tests.map((t) => t.id);
  }

  async listRecentRuns(testId: string, sinceDate: Date, limit: number): Promise<ScorableRun[]> {
    return this.prisma.testRun.findMany({
      where: { testId, startedAt: { gte: sinceDate } },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: { status: true, startedAt: true },
    });
  }

  async saveFlakinessScore(testId: string, computation: FlakinessComputation): Promise<void> {
    await this.prisma.flakinessScore.create({
      data: {
        testId,
        windowStart: computation.windowStart,
        windowEnd: computation.windowEnd,
        flipRate: computation.flipRate,
        confidenceScore: computation.confidenceScore,
        status: computation.status,
      },
    });
  }
}
