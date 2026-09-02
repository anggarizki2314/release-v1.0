import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[React ErrorBoundary Caught Error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleGoHome = () => {
    try {
      localStorage.removeItem('forex_replay_last_opened_session_id');
    } catch {}
    window.location.href = window.location.origin + window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            width: '100vw',
            background: '#131722',
            color: '#d1d4dc',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            padding: '24px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '650px',
              width: '100%',
              background: '#1e222d',
              border: '1px solid #2a2e39',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <h2 style={{ color: '#ef5350', margin: '0 0 12px 0', fontSize: '18px' }}>
              Terjadi Kesalahan Tampilan (UI Error)
            </h2>
            <p style={{ color: '#f87171', fontSize: '13.5px', fontWeight: 600, lineHeight: '1.5', margin: '0 0 12px 0' }}>
              {this.state.error?.message || 'Unknown error occurred'}
            </p>

            {this.state.error?.stack && (
              <pre
                style={{
                  background: '#131722',
                  color: '#94a3b8',
                  fontSize: '11px',
                  textAlign: 'left',
                  padding: '12px',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  maxHeight: '160px',
                  marginBottom: '16px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {this.state.error.stack}
              </pre>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  background: '#2962ff',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 20px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Muat Ulang Aplikasi (Reload)
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#f1f5f9',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '9px 20px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Kembali ke Beranda
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
