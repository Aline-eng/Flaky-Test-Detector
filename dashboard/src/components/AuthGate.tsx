import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthGate({ children }: { children: ReactNode }) {
  const { token, setToken } = useAuth();
  const [input, setInput] = useState('');

  if (token) {
    return <>{children}</>;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (input.trim()) setToken(input.trim());
  }

  return (
    <main className="auth-gate">
      <h1>Flaky Test Detector</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="dashboard-token">Dashboard access token</label>
        <input
          id="dashboard-token"
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="DASHBOARD_ACCESS_TOKEN"
          autoFocus
        />
        <button type="submit">Continue</button>
      </form>
    </main>
  );
}
