"use client";

import React from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (typeof window !== "undefined") {
      console.error("Atlas error boundary:", error, info);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  hardReset = () => {
    if (typeof window === "undefined") return;
    if (
      confirm(
        "Reset the local workspace? This clears papers, comments, and settings on this browser. You can re-add API keys after.",
      )
    ) {
      try {
        localStorage.removeItem("atlas:settings");
      } catch {}
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="panel p-6 max-w-md w-full">
          <div className="flex items-center gap-2 text-danger mb-3">
            <AlertTriangle className="size-5" />
            <h2 className="text-[15px] font-semibold">Something broke</h2>
          </div>
          <p className="text-[13px] text-muted mb-3">
            Atlas hit an error rendering this view. Your local drafts are
            still on this device — refresh first; if that doesn&apos;t work,
            reset the workspace.
          </p>
          {this.state.error && (
            <pre className="text-[11px] font-mono text-subtle bg-surface border border-border rounded p-2 mb-4 overflow-x-auto">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary h-8 text-[12px]"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </button>
            <button
              onClick={this.reset}
              className="btn btn-ghost h-8 text-[12px]"
            >
              Try again
            </button>
            <button
              onClick={this.hardReset}
              className="btn btn-ghost h-8 text-[12px] text-danger ml-auto"
            >
              <Trash2 className="size-3.5" />
              Reset workspace
            </button>
          </div>
        </div>
      </div>
    );
  }
}
