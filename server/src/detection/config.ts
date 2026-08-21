import { env } from '../config/env';
import type { FlakinessConfig } from './types';

export function loadFlakinessConfigFromEnv(): FlakinessConfig {
  return {
    windowSize: env.FLAKINESS_WINDOW_SIZE,
    windowMaxAgeDays: env.FLAKINESS_WINDOW_MAX_AGE_DAYS,
    minRuns: env.FLAKINESS_MIN_RUNS,
    flagThreshold: env.FLAKINESS_FLAG_THRESHOLD,
    quarantineThreshold: env.FLAKINESS_QUARANTINE_THRESHOLD,
  };
}
