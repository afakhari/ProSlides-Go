import { Link } from "react-router-dom";

type SiteHeaderProps = {
  className?: string;
};

function LogoMark() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-lg font-semibold text-content before:text-xl before:content-['✱'] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      aria-label="صفحه اصلی ProSlides"
      dir="ltr"
    >
      ProSlides
    </Link>
  );
}

export default function SiteHeader({ className = "" }: SiteHeaderProps) {
  const headerClassName = [
    "border-b border-border-subtle bg-surface/95 backdrop-blur",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName} dir="rtl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <LogoMark />
        <nav
          className="hidden items-center gap-6 text-sm font-semibold text-content-muted md:flex"
          aria-label="ناوبری اصلی"
        >
          <Link
            to="/team"
            className="rounded-lg px-2 py-2 transition-colors hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            تیم ما
          </Link>
        </nav>
        <div className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
          <Link
            to="/login"
            className="min-h-11 rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-content transition-colors hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4"
          >
            ورود
          </Link>
          <Link
            to="/signup"
            className="min-h-11 rounded-xl bg-brand px-3 py-2.5 text-content-inverse shadow-sm transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4"
          >
            ثبت‌نام رایگان
          </Link>
        </div>
      </div>
    </header>
  );
}
