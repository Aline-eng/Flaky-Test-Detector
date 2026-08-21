import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Layout() {
  const { repo, setRepo, setToken } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Flaky Test Detector</h1>
        <nav>
          <Link to="/">Overview</Link>
          <Link to="/quarantine">Quarantine</Link>
        </nav>
        <label className="repo-input">
          Repo
          <input value={repo} onChange={(e) => setRepo(e.target.value)} />
        </label>
        <button type="button" onClick={() => setToken(null)}>
          Sign out
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
