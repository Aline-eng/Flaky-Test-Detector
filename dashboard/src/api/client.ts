import type { FlakinessStatus, TestDetail, TestListItem } from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  token: string;
}

async function request<T>(config: ApiClientConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => ({}));
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function listTests(config: ApiClientConfig, repo: string): Promise<TestListItem[]> {
  return request<TestListItem[]>(config, `/api/tests?repo=${encodeURIComponent(repo)}`);
}

export function getTestDetail(config: ApiClientConfig, testId: string): Promise<TestDetail> {
  return request<TestDetail>(config, `/api/tests/${encodeURIComponent(testId)}`);
}

export function overrideQuarantineStatus(
  config: ApiClientConfig,
  testId: string,
  status: FlakinessStatus,
  reason: string,
): Promise<void> {
  return request<void>(config, `/api/tests/${encodeURIComponent(testId)}/quarantine`, {
    method: 'POST',
    body: JSON.stringify({ status, reason }),
  });
}
