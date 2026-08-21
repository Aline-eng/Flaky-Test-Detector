import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { TestDetailPage } from './pages/TestDetailPage';
import { QuarantinePage } from './pages/QuarantinePage';

function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<OverviewPage />} />
              <Route path="tests/:id" element={<TestDetailPage />} />
              <Route path="quarantine" element={<QuarantinePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthGate>
    </AuthProvider>
  );
}

export default App;
