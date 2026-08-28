import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";
import { Outlet, useLocation, useParams } from "react-router-dom";
import RequireSession from "../../components/RequireSession.tsx";
import EditorRouteSkeleton from "../../modules/presentations/ui/EditorRouteSkeleton";
import { fa } from "../../shared/i18n/fa";
import Notice from "../../shared/ui/Notice";

type BoundaryProps = {
  children: ReactNode;
  dashboardPath: string;
  resetKey: string;
};

type BoundaryState = { error: Error | null };

class ManagerRouteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ManagerRouteErrorBoundary] Route render failed", error, info);
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-soft px-4" dir="rtl">
        <div className="w-full max-w-lg rounded-3xl border border-danger-border bg-surface p-6 shadow-panel">
          <h1 className="text-xl font-black text-content">{fa.managerShell.routeErrorTitle}</h1>
          <Notice tone="error" className="mt-4">
            {fa.managerShell.routeErrorBody}
          </Notice>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.retry}
              className="rounded-control bg-brand px-4 py-2.5 font-bold text-content-inverse hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {fa.managerShell.retry}
            </button>
            <a
              href={this.props.dashboardPath}
              className="rounded-control border border-brand-border bg-surface px-4 py-2.5 font-bold text-brand-strong hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {fa.managerShell.backToDashboard}
            </a>
          </div>
        </div>
      </main>
    );
  }
}

function ManagerRouteFallback() {
  const location = useLocation();
  if (/\/panel\/[^/]+\/?$/.test(location.pathname)) return <EditorRouteSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-soft to-canvas" dir="rtl">
      <div className="h-16 border-b border-brand-border bg-surface" />
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <Notice pending>{fa.managerShell.loadingDashboard}</Notice>
        <div className="mt-6 h-56 animate-pulse rounded-3xl border border-brand-border bg-surface motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export default function ProtectedManagerShell() {
  const location = useLocation();
  const { role = "manager" } = useParams();
  const dashboardPath = `/${role}/panel`;

  return (
    <div data-manager-shell="protected" className="min-h-screen bg-canvas">
      <RequireSession>
        <ManagerRouteErrorBoundary dashboardPath={dashboardPath} resetKey={location.pathname}>
          <Suspense fallback={<ManagerRouteFallback />}>
            <Outlet />
          </Suspense>
        </ManagerRouteErrorBoundary>
      </RequireSession>
    </div>
  );
}
