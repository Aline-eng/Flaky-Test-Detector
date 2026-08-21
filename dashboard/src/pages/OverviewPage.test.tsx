import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test-utils';
import { OverviewPage } from './OverviewPage';

beforeEach(() => {
  window.localStorage.clear();
});

describe('OverviewPage', () => {
  it('renders tests sorted by confidence score, highest first', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 't1',
            repo: 'o/r',
            suite: 'unit',
            name: 'low',
            latestScore: {
              status: 'STABLE',
              confidenceScore: 0.1,
              flipRate: 0.1,
              computedAt: '2026-01-01T00:00:00Z',
            },
            quarantineStatus: 'STABLE',
          },
          {
            id: 't2',
            repo: 'o/r',
            suite: 'unit',
            name: 'high',
            latestScore: {
              status: 'QUARANTINED',
              confidenceScore: 0.9,
              flipRate: 0.9,
              computedAt: '2026-01-01T00:00:00Z',
            },
            quarantineStatus: 'QUARANTINED',
          },
        ]),
        { status: 200 },
      ),
    );

    renderWithProviders(<OverviewPage />);

    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 data rows
    expect(rows[1]).toHaveTextContent('high');
    expect(rows[2]).toHaveTextContent('low');
  });

  it('shows an empty state when there are no tests', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    renderWithProviders(<OverviewPage />);
    expect(await screen.findByText(/no tests ingested/i)).toBeInTheDocument();
  });
});
