import React from 'react';
import * as Sentry from '@sentry/react';

/**
 * ErrorBoundary
 * Catches JavaScript errors in child component trees, logs them, and displays a premium fallback interface.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    Sentry.captureException(error, { extra: errorInfo });
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-850 dark:text-slate-100 font-sans">
          <div className="w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl p-8 relative overflow-hidden animate-fadeIn">
            {/* Top decorative alert stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />

            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Something went wrong</h2>
            </div>

            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              {this.props.fallbackMessage || 'An unexpected error occurred in this section. Please try reloading the page or reset the app state.'}
            </p>

            {/* Developer mode detailed debug panel */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                <summary className="text-xs font-bold text-slate-500 cursor-pointer outline-none select-none">
                  Stack Trace Details
                </summary>
                <div className="mt-3 text-xxs font-mono text-slate-600 dark:text-slate-400 max-h-40 overflow-y-auto leading-relaxed">
                  <div className="font-semibold text-red-500 mb-1">{this.state.error.toString()}</div>
                  {this.state.errorInfo?.componentStack}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold hover:opacity-90 transition duration-150 text-sm cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-900 transition duration-150 text-sm cursor-pointer text-slate-700 dark:text-slate-350"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;