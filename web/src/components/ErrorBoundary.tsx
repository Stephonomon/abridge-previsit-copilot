import { Component, type ReactNode } from "react";

/**
 * Scoped around the copilot window so a render error there (bad CDS data,
 * a bug in a card component, etc.) shows a small recoverable card instead of
 * silently unmounting the ENTIRE app — trackboard, chart, demo controls
 * included, since without this React unmounts everything on an uncaught
 * render error with no boundary anywhere in the tree.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Copilot window crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed z-50 bottom-4 right-4 w-80 bg-white border border-red-200 rounded-2xl shadow-xl p-4">
          <div className="text-sm font-bold text-red-600 mb-1">Copilot window hit an error</div>
          <div className="text-xs text-stone-500 mb-3">{this.state.error.message}</div>
          <button
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
            className="text-xs font-semibold bg-indigo-brand hover:bg-indigo-brand-dark text-white rounded-full px-3 py-1.5"
          >
            Reload copilot
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
