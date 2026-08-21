import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { AuthProvider } from './context/AuthContext';

export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string; path?: string; token?: string } = {},
) {
  const { route = '/', path = '/', token = 'test-token' } = options;
  window.localStorage.setItem('flaky-test-detector.token', token);

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}
