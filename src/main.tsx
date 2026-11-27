import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary, FatalScreen } from './ui/ErrorBoundary';
import { initDatabase } from './db/database';
import { getSettings } from './data/settings';
import { errorMessage, logError } from './lib/log';

// Avoid a light/dark flash before the database is open.
try {
  if (localStorage.getItem('ph-theme') === 'light') document.documentElement.classList.remove('dark');
} catch {
  /* ignore */
}

window.addEventListener('error', (e) => logError('window.error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => logError('unhandledrejection', e.reason));

const root = createRoot(document.getElementById('root')!);

async function boot() {
  try {
    await initDatabase();
    const settings = await getSettings();
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App initialSettings={settings} />
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (e) {
    logError('boot', e);
    root.render(<FatalScreen message={`Veritabanı açılamadı: ${errorMessage(e)}`} onRetry={() => location.reload()} />);
  }
}

void boot();
