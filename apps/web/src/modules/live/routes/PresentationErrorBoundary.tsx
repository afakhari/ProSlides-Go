import { Component, type ErrorInfo, type ReactNode } from "react";

type PresentationErrorBoundaryProps = {
  children: ReactNode;
};

type PresentationErrorBoundaryState = {
  hasError: boolean;
};

export class PresentationErrorBoundary extends Component<
  PresentationErrorBoundaryProps,
  PresentationErrorBoundaryState
> {
  state: PresentationErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PresentationErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error(
      "[PresentationErrorBoundary] Runtime error:",
      error,
      errorInfo,
    );
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h2 className="text-xl font-bold">خطا در اجرای ارائه</h2>
          <p className="mt-2 text-sm text-white/70">
            خطایی هنگام اجرا رخ داد. برای بازیابی جلسه، لطفاً صفحه را دوباره بارگذاری کنید.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            بارگذاری مجدد
          </button>
        </div>
      </div>
    );
  }
}
