import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";

import Notice from "../../shared/ui/Notice.tsx";
import { Button } from "../../shared/ui/primitives/Button.tsx";

type ErrorSurfaceProps = {
  title: string;
  homePath: string;
  homeLabel: string;
};

const errorMessage = (error: unknown): string => {
  if (isRouteErrorResponse(error)) {
    if (error.status === 404) return "صفحه یا داده درخواستی پیدا نشد.";
    if (error.status === 403) return "اجازه دسترسی به این بخش را ندارید.";
  }

  return "بارگذاری این بخش انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.";
};

function RouteErrorSurface({
  title,
  homePath,
  homeLabel,
}: ErrorSurfaceProps) {
  const error = useRouteError();

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-canvas px-4"
      dir="rtl"
    >
      <section className="w-full max-w-lg rounded-panel border border-danger-border bg-surface p-6 shadow-panel">
        <h1 className="text-xl font-black text-content">{title}</h1>
        <Notice tone="error" className="mt-4">
          {errorMessage(error)}
        </Notice>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => window.location.reload()}>
            تلاش دوباره
          </Button>
          <Button asChild variant="outline">
            <Link to={homePath}>{homeLabel}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

export function AppRouteErrorBoundary() {
  return (
    <RouteErrorSurface
      title="بارگذاری صفحه انجام نشد"
      homePath="/"
      homeLabel="بازگشت به صفحه اصلی"
    />
  );
}

export function ManagerRouteErrorBoundary() {
  return (
    <RouteErrorSurface
      title="بارگذاری بخش مدیریت انجام نشد"
      homePath="/manager/panel"
      homeLabel="بازگشت به پنل مدیریت"
    />
  );
}
