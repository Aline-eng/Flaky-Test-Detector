import { useParams } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API_BASE_URL } from '../context/AuthContext';
import { getTestDetail } from '../api/client';
import { useApiData } from '../hooks/useApiData';
import { StatusBadge } from '../components/StatusBadge';

export function TestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApiData(
    (token) => getTestDetail({ baseUrl: API_BASE_URL, token }, id ?? ''),
    id ?? '',
  );

  if (loading) return <p>Loading…</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!data) return null;

  const chartData = [...data.scoreHistory]
    .sort((a, b) => new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime())
    .map((s) => ({
      computedAt: new Date(s.computedAt).toLocaleDateString(),
      confidenceScore: Number(s.confidenceScore.toFixed(4)),
    }));

  return (
    <section>
      <h2>
        {data.suite} / {data.name}
      </h2>
      <p>
        <StatusBadge status={data.quarantineStatus} /> in {data.repo}
      </p>
      {data.filePath && <p className="file-path">{data.filePath}</p>}

      <h3>Confidence score trend</h3>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="computedAt" />
            <YAxis domain={[0, 1]} />
            <Tooltip />
            <Line type="monotone" dataKey="confidenceScore" stroke="#e11d48" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p>No score history yet.</p>
      )}

      <h3>Quarantine history</h3>
      {data.quarantineHistory.length === 0 ? (
        <p>No quarantine transitions yet.</p>
      ) : (
        <ul>
          {data.quarantineHistory.map((event) => (
            <li key={`${event.transitionedTo}-${event.occurredAt}`}>
              <StatusBadge status={event.transitionedTo} /> — {event.reason} (
              {new Date(event.occurredAt).toLocaleString()})
            </li>
          ))}
        </ul>
      )}

      <h3>Recent runs</h3>
      {data.runs.length === 0 ? (
        <p>No runs recorded yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Branch</th>
              <th>Commit</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {data.runs.slice(0, 30).map((run) => (
              <tr key={`${run.commitSha}-${run.startedAt}`}>
                <td>{run.status}</td>
                <td>{run.branch}</td>
                <td>{run.commitSha.slice(0, 7)}</td>
                <td>{new Date(run.startedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
