import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RefreshCw, ServerCrash } from 'lucide-react';
import { AppProvider, useApp } from './state/AppStore';
import ErrorBoundary from './components/ErrorBoundary';
import Toaster from './components/Toaster';
import Landing from './pages/Landing';
import AssistantWorkspace from './pages/AssistantWorkspace';
import ClientView from './pages/ClientView';

function ServerDown({ detail, onRetry }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="card w-full max-w-md p-6 text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50">
          <ServerCrash className="size-5 text-amber-600" />
        </div>
        <h1 className="text-base font-semibold tracking-tight text-slate-900">The Relay API is not reachable</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Run <code className="rounded bg-slate-100 px-1 text-xs">npm run dev</code> from the project root so the Express server starts on port
          5050, then retry. The inbox, classifications and copilot all live server-side.
        </p>
        {detail ? <p className="mt-2 text-2xs text-slate-400">{detail}</p> : null}
        <button type="button" className="btn-primary mt-4 w-full" onClick={onRetry}>
          <RefreshCw className="size-4" /> Retry connection
        </button>
      </div>
    </div>
  );
}

function RequireSession({ children }) {
  const { session } = useApp();
  if (!session) return <Navigate to="/" replace />;
  return children;
}

function Shell() {
  const { bootError, refresh } = useApp();
  const location = useLocation();
  const needsServer = location.pathname.startsWith('/assistant') || location.pathname.startsWith('/client');

  if (needsServer && bootError) return <ServerDown detail={bootError} onRetry={() => refresh()} />;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/assistant"
        element={
          <RequireSession>
            <AssistantWorkspace />
          </RequireSession>
        }
      />
      <Route
        path="/client"
        element={
          <RequireSession>
            <ClientView />
          </RequireSession>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
        <Toaster />
      </AppProvider>
    </ErrorBoundary>
  );
}
