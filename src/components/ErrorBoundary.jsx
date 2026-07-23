import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Something went wrong</h3>
          <p className="text-sm text-text-secondary max-w-md mb-4">{this.state.error?.message || 'Unknown error'}</p>
          <pre className="text-xs text-left bg-surface border border-border rounded-lg p-4 max-w-full overflow-auto max-h-[200px] text-text-muted">
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
