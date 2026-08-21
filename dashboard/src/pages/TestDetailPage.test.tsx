import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test-utils';
import { TestDetailPage } from './TestDetailPage';

beforeEach(() => {
  window.localStorage.clear();
});

describe('TestDetailPage', () => {
  it('renders test details, quarantine history, and recent runs', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'test-1',
          repo: 'o/r',
          suite: 'unit',
          name: 'flaky it',
          filePath: 'test/flaky.test.ts',
          firstSeenAt: '2025-01-01T00:00:00Z',
          latestScore: {
            status: 'FLAGGED',
            confidenceScore: 0.2,
            flipRate: 0.3,
            computedAt: '2026-01-01T00:00:00Z',
          },
          quarantineStatus: 'FLAGGED',
          runs: [
            {
              status: 'FAILED',
              startedAt: '2026-01-01T00:00:00Z',
              durationMs: 100,
              branch: 'main',
              commitSha: 'abcdef1234',
            },
          ],
          scoreHistory: [
            {
              status: 'FLAGGED',
              confidenceScore: 0.2,
              flipRate: 0.3,
              computedAt: '2026-01-01T00:00:00Z',
            },
          ],
          quarantineHistory: [
            {
              transitionedTo: 'FLAGGED',
              reason: 'flakiness detection classified this test as FLAGGED',
              occurredAt: '2026-01-01T00:00:00Z',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    renderWithProviders(<TestDetailPage />, { route: '/tests/test-1', path: '/tests/:id' });

    expect(await screen.findByRole('heading', { name: /unit \/ flaky it/i })).toBeInTheDocument();
    expect(screen.getByText(/test\/flaky\.test\.ts/)).toBeInTheDocument();
    expect(
      screen.getByText(/flakiness detection classified this test as flagged/i),
    ).toBeInTheDocument();
    expect(screen.getByText('abcdef1')).toBeInTheDocument();
  });

  it('shows an empty state when the test has no run history yet', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'test-1',
          repo: 'o/r',
          suite: 'unit',
          name: 'brand new',
          filePath: null,
          firstSeenAt: '2026-01-01T00:00:00Z',
          latestScore: null,
          quarantineStatus: 'STABLE',
          runs: [],
          scoreHistory: [],
          quarantineHistory: [],
        }),
        { status: 200 },
      ),
    );

    renderWithProviders(<TestDetailPage />, { route: '/tests/test-1', path: '/tests/:id' });

    expect(await screen.findByText(/no score history yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no quarantine transitions yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no runs recorded yet/i)).toBeInTheDocument();
  });
});
