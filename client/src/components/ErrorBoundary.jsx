import { Component } from 'react';
import { RefreshCw, ServerCrash } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[Relay] UI error boundary caught:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="card w-full max-w-md p-6 text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50">
            <ServerCrash className="size-5 text-rose-600" />
          </div>
          <h1 className="text-base font-semibold tracking-tight text-slate-900">This panel hit an unexpected error</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            The rest of Relay is unaffected. Reload to restore the workspace — your inbox state is stored server-side.
          </p>
          <pre className="mt-3 max-h-28 overflow-auto rounded-lg border border-hairline bg-slate-50 p-2.5 text-left text-2xs text-slate-500">
            {String(error?.message || error)}
          </pre>
          <button type="button" className="btn-primary mt-4 w-full" onClick={() => window.location.reload()}>
            <RefreshCw className="size-4" /> Reload workspace
          </button>
        </div>
      </div>
    );
  }
}
