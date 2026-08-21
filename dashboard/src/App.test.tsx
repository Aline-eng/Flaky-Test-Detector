import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
});

describe('App', () => {
  it('shows the access-token gate when no token is stored', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /flaky test detector/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/dashboard access token/i)).toBeInTheDocument();
  });

  it('reveals the dashboard nav once a token is entered', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/dashboard access token/i), 'my-token');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(await screen.findByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /quarantine/i })).toBeInTheDocument();
  });
});
