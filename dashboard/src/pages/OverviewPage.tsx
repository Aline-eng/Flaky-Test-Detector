import { Link } from 'react-router-dom';
import { API_BASE_URL, useAuth } from '../context/AuthContext';
import { listTests } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { StatusBadge } from '../components/StatusBadge';
import type { TestListItem } from '../api/types';

function sortByConfidence(tests: TestListItem[]): TestListItem[] {
  return [...tests].sort(
    (a, b) => (b.latestScore?.confidenceScore ?? -1) - (a.latestScore?.confidenceScore ?? -1),
  );
}

export function OverviewPage() {
  const { repo } = useAuth();
  const { data, error, loading } = useApiData(
    (token) => listTests({ baseUrl: API_BASE_URL, token }, repo),
    repo,
  );

  return (
    <section>
      <h2>Top flaky tests — {repo}</h2>
      {loading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {data && data.length === 0 && <p>No tests ingested for this repo yet.</p>}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Suite</th>
              <th>Status</th>
              <th>Confidence</th>
              <th>Flip rate</th>
              <th>Last scored</th>
            </tr>
          </thead>
          <tbody>
            {sortByConfidence(data).map((test) => (
              <tr key={test.id}>
                <td>
                  <Link to={`/tests/${test.id}`}>{test.name}</Link>
                </td>
                <td>{test.suite}</td>
                <td>
                  <StatusBadge status={test.quarantineStatus} />
                </td>
                <td>{test.latestScore ? test.latestScore.confidenceScore.toFixed(3) : '—'}</td>
                <td>
                  {test.latestScore ? `${Math.round(test.latestScore.flipRate * 100)}%` : '—'}
                </td>
                <td>
                  {test.latestScore ? new Date(test.latestScore.computedAt).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
