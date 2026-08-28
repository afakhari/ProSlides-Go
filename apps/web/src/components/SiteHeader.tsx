import { Link } from "react-router-dom";

function LogoMark() {
  return (
    <Link to="/" className="inline-flex items-center gap-1.5 text-lg font-semibold text-content before:text-xl before:content-['✱']">
      ProSlides
    </Link>
  );
}

export default function SiteHeader({ className = "" }: { className?: string }) {
  const headerClassName = ["border-b border-border-subtle bg-surface", className]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-4">
        <LogoMark />
        <nav className="hidden items-center gap-6 text-sm font-semibold text-content-muted md:flex" aria-label="ناوبری اصلی" />
        <div className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
          <Link to="/login" className="rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-content transition-colors hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4 sm:py-2">ورود</Link>
          <Link to="/signup" className="rounded-xl bg-brand px-3 py-1.5 text-content-inverse shadow-sm transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4 sm:py-2">ثبت‌نام رایگان</Link>
        </div>
      </div>
    </header>
  );
}
