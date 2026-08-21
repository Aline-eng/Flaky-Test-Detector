import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test-utils';
import { QuarantinePage } from './QuarantinePage';

beforeEach(() => {
  window.localStorage.clear();
});

const LIST = [
  {
    id: 't1',
    repo: 'o/r',
    suite: 'unit',
    name: 'flaky it',
    latestScore: null,
    quarantineStatus: 'QUARANTINED',
  },
  {
    id: 't2',
    repo: 'o/r',
    suite: 'unit',
    name: 'stable it',
    latestScore: null,
    quarantineStatus: 'STABLE',
  },
];

describe('QuarantinePage', () => {
  it('lists only flagged/quarantined tests', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(LIST), { status: 200 }),
    );
    renderWithProviders(<QuarantinePage />);

    expect(await screen.findByText(/flaky it/)).toBeInTheDocument();
    expect(screen.queryByText(/stable it/)).not.toBeInTheDocument();
  });

  it('requires a reason before submitting a manual override', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(LIST), { status: 200 }),
    );
    const user = userEvent.setup();
    renderWithProviders(<QuarantinePage />);

    await screen.findByText(/flaky it/);
    await user.click(screen.getByRole('button', { name: /mark stable/i }));

    expect(await screen.findByText(/reason is required/i)).toBeInTheDocument();
  });

  it('submits a manual override with a reason and reloads the list', async () => {
    const fetchMock = vi.spyOn(global, 'fetch');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(LIST), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ ...LIST[0], quarantineStatus: 'STABLE' }, LIST[1]]), {
        status: 200,
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<QuarantinePage />);

    await screen.findByText(/flaky it/);
    await user.type(screen.getByLabelText(/reason for overriding flaky it/i), 'confirmed fixed');
    await user.click(screen.getByRole('button', { name: /mark stable/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const overrideCall = fetchMock.mock.calls[1];
    expect(overrideCall[0]).toContain('/api/tests/t1/quarantine');
    expect(JSON.parse((overrideCall[1]?.body as string) ?? '{}')).toEqual({
      status: 'STABLE',
      reason: 'confirmed fixed',
    });
  });
});
