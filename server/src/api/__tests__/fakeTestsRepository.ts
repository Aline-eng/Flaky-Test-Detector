import type { TestDetail, TestListItem, TestsRepository } from '../testsRepository';

export function createFakeTestsRepository(
  seed: {
    listByRepo?: Record<string, TestListItem[]>;
    detailById?: Record<string, TestDetail>;
  } = {},
): TestsRepository & { overrides: Array<{ testId: string; status: string; reason: string }> } {
  const overrides: Array<{ testId: string; status: string; reason: string }> = [];

  return {
    overrides,
    async listTests(repo) {
      return seed.listByRepo?.[repo] ?? [];
    },
    async getTestDetail(testId) {
      return seed.detailById?.[testId] ?? null;
    },
    async recordManualOverride(testId, status, reason) {
      if (!seed.detailById?.[testId]) return false;
      overrides.push({ testId, status, reason });
      return true;
    },
  };
}
