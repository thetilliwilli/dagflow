// Перехват ошибок отрисовки: понятное сообщение вместо белого экрана (принцип IV)
import { Component, type ReactNode } from 'react';
import { messages } from './messages';

interface State {
  failed: boolean;
  attempt: number;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="error-boundary" role="alert">
          <p>{messages.renderFailed}</p>
          <button
            type="button"
            onClick={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}
          >
            {messages.reloadTab}
          </button>
        </div>
      );
    }
    return (
      <div key={this.state.attempt} className="error-boundary__content">
        {this.props.children}
      </div>
    );
  }
}
