import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  message: string | null;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { message: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      message: error.message || 'Something went wrong while loading the page.',
    };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Errors are already surfaced through the fallback UI.
  }

  render(): ReactNode {
    if (this.state.message) {
      return (
        <div className="page-loading" role="alert">
          <p>{this.state.message}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
