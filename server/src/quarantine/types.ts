import type { FlakinessStatus } from '../detection/types';

export type QuarantineStatus = FlakinessStatus;

export interface QuarantineTransition {
  toStatus: QuarantineStatus;
  reason: string;
}

export interface TestSummary {
  id: string;
  repo: string;
  suite: string;
  name: string;
}
