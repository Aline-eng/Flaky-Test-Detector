import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL, useAuth } from '../context/AuthContext';
import { ApiError, listTests, overrideQuarantineStatus } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { StatusBadge } from '../components/StatusBadge';
import type { FlakinessStatus } from '../api/types';

export function QuarantinePage() {
  const { repo, token, setToken } = useAuth();
  const { data, error, loading, reload } = useApiData(
    (t) => listTests({ baseUrl: API_BASE_URL, token: t }, repo),
    repo,
  );
  const [reasonByTest, setReasonByTest] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const quarantineList = (data ?? []).filter((t) => t.quarantineStatus !== 'STABLE');

  async function handleOverride(testId: string, status: FlakinessStatus) {
    if (!token) return;
    const reason = reasonByTest[testId]?.trim();
    if (!reason) {
      setSubmitError('A reason is required for a manual override.');
      return;
    }

    setSubmitError(null);
    try {
      await overrideQuarantineStatus({ baseUrl: API_BASE_URL, token }, testId, status, reason);
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
        return;
      }
      setSubmitError(err instanceof Error ? err.message : 'Override failed');
    }
  }

  return (
    <section>
      <h2>Quarantine — {repo}</h2>
      {loading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {submitError && <p role="alert">{submitError}</p>}
      {data && quarantineList.length === 0 && <p>No flagged or quarantined tests right now.</p>}
      {quarantineList.length > 0 && (
        <ul className="quarantine-list">
          {quarantineList.map((test) => (
            <li key={test.id}>
              <div className="quarantine-list__test">
                <Link to={`/tests/${test.id}`}>
                  {test.suite} / {test.name}
                </Link>
                <StatusBadge status={test.quarantineStatus} />
              </div>
              <div className="quarantine-list__controls">
                <input
                  placeholder="Reason for override"
                  aria-label={`Reason for overriding ${test.name}`}
                  value={reasonByTest[test.id] ?? ''}
                  onChange={(e) =>
                    setReasonByTest((prev) => ({ ...prev, [test.id]: e.target.value }))
                  }
                />
                <button type="button" onClick={() => handleOverride(test.id, 'STABLE')}>
                  Mark stable
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
