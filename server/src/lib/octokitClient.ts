import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import { env } from '../config/env';
import { logger } from './logger';

const ThrottledOctokit = Octokit.plugin(retry, throttling);

const MAX_RATE_LIMIT_RETRIES = 3;

interface ThrottleRequestOptions {
  method: string;
  url: string;
}

/**
 * An Octokit client that automatically backs off on both primary rate limits
 * (x-ratelimit-remaining exhausted) and secondary/abuse rate limits (retry-after header),
 * via the official throttling + retry plugins, up to MAX_RATE_LIMIT_RETRIES attempts.
 */
export function createOctokitClient(): InstanceType<typeof ThrottledOctokit> {
  return new ThrottledOctokit({
    auth: env.GITHUB_TOKEN,
    throttle: {
      onRateLimit: (
        retryAfter: number,
        options: ThrottleRequestOptions,
        _octokit,
        retryCount: number,
      ) => {
        logger.warn(
          { retryAfter, method: options.method, url: options.url, retryCount },
          'GitHub API primary rate limit hit; retrying with backoff',
        );
        return retryCount < MAX_RATE_LIMIT_RETRIES;
      },
      onSecondaryRateLimit: (
        retryAfter: number,
        options: ThrottleRequestOptions,
        _octokit,
        retryCount: number,
      ) => {
        logger.warn(
          { retryAfter, method: options.method, url: options.url, retryCount },
          'GitHub API secondary rate limit hit; retrying with backoff',
        );
        return retryCount < MAX_RATE_LIMIT_RETRIES;
      },
    },
  });
}

export type OctokitClient = InstanceType<typeof ThrottledOctokit>;
