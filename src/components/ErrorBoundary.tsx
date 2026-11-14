import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface State {
  error: Error | null;
  copied: boolean;
}

/**
 * Last line of defence: a render error shows a calm screen instead of a blank page.
 * Data lives in storage and the account, so reloading loses nothing.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, copied: false };
  private info = '';

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.info = info.componentStack ?? '';
    console.error(error);
  }

  private report() {
    const e = this.state.error;
    return [
      `Foundry ${__APP_VERSION__}`,
      `Screen: ${location.hash || '#/'}`,
      `Device: ${navigator.userAgent}`,
      `Error: ${e?.message}`,
      (e?.stack ?? '').split('\n').slice(0, 8).join('\n'),
      this.info.split('\n').slice(0, 8).join('\n'),
    ].join('\n');
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="welcome crash">
        <h1>{t('Something went wrong')}</h1>
        <p>{t('This screen hit a bug. Your data is safe: it is saved on this phone and in your account.')}</p>
        <button className="btn btn-primary btn-wide" onClick={() => location.reload()}>
          {t('Reload the app')}
        </button>
        <button
          className="btn btn-wide"
          onClick={() => {
            location.hash = '#/';
            this.setState({ error: null });
          }}
        >
          {t('Go to start')}
        </button>
        <button
          className="link-btn"
          onClick={() => navigator.clipboard?.writeText(this.report()).then(() => this.setState({ copied: true }), () => {})}
        >
          {this.state.copied ? t('Copied. Send it to us with what you were doing.') : t('Copy the error details')}
        </button>
      </main>
    );
  }
}
