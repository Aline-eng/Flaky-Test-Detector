import type { TestSummary } from './types';

export interface QuarantineNotifier {
  notifyQuarantined(test: TestSummary, reason: string): Promise<void>;
}
