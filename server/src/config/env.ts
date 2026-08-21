import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
    SLACK_WEBHOOK_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
    DASHBOARD_ACCESS_TOKEN: z.string().min(1, 'DASHBOARD_ACCESS_TOKEN is required'),

    // Detection engine tuning — see docs/adr/0001-wilson-score-confidence-intervals.md for
    // why these are confidence-interval thresholds rather than a raw failure-rate cutoff.
    FLAKINESS_WINDOW_SIZE: z.coerce.number().int().positive().default(50),
    FLAKINESS_WINDOW_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),
    FLAKINESS_MIN_RUNS: z.coerce.number().int().positive().default(6),
    FLAKINESS_FLAG_THRESHOLD: z.coerce.number().min(0).max(1).default(0.15),
    FLAKINESS_QUARANTINE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.3),

    // How many consecutive clean (passed) runs a quarantined test needs before it's
    // auto-promoted back to stable — see docs/adr/0003-quarantine-auto-promotion.md.
    QUARANTINE_CLEAN_RUNS_REQUIRED: z.coerce.number().int().positive().default(10),
  })
  .refine((data) => data.FLAKINESS_QUARANTINE_THRESHOLD >= data.FLAKINESS_FLAG_THRESHOLD, {
    message: 'FLAKINESS_QUARANTINE_THRESHOLD must be >= FLAKINESS_FLAG_THRESHOLD',
    path: ['FLAKINESS_QUARANTINE_THRESHOLD'],
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // eslint-disable-next-line no-console -- fatal startup failure, before the logger exists
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv(process.env);
