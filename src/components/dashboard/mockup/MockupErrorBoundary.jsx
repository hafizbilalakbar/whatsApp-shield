import React from 'react';
import { Smartphone, RefreshCw, AlertCircle } from 'lucide-react';

export class MockupErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[MockupErrorBoundary] Live Phone Preview caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed left-6 bottom-20 z-[995] flex flex-col items-center justify-center p-6 text-center animate-fade-in"
          style={{
            width: 'min(420px, calc(100vw - 32px))',
            borderRadius: 20,
            background: 'linear-gradient(145deg, #131926 0%, #0A0D15 100%)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 20px rgba(239, 68, 68, 0.15)',
            color: '#FFFFFF'
          }}
          role="alert"
        >
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Preview Temporarily Unavailable</h4>
          <p className="text-xs text-white/60 mb-4 max-w-[280px]">
            The phone preview caught an unexpected state. The rest of the app is running normally.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition-all"
            >
              <RefreshCw size={13} /> Retry Preview
            </button>
            {this.props.onClose && (
              <button
                type="button"
                onClick={this.props.onClose}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition-all"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MockupErrorBoundary;
