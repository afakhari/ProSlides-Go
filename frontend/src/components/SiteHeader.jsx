import { useState } from "react";
import { Link } from "react-router-dom";

function LogoMark() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-[#111827] font-semibold text-lg before:content-['✱'] before:text-xl"
    >
      ProSlides
    </Link>
  );
}

export default function SiteHeader({ className = "" }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerClassName = ["border-b border-[#e5e7eb] bg-white", className]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e7eb] text-[#111827] transition hover:border-[#cbd5f5] md:hidden"
            aria-expanded={isMenuOpen}
            aria-controls="site-nav"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span className="sr-only">Toggle navigation</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <LogoMark />
        </div>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[#6b7280] md:flex">
          <span className="flex items-center gap-2 text-[#94a3b8]">
            Features
            <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              Soon
            </span>
          </span>
          <span className="flex items-center gap-2 text-[#94a3b8]">
            Use cases
            <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              Soon
            </span>
          </span>
          <span className="flex items-center gap-2 text-[#94a3b8]">
            Pricing
            <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
              Soon
            </span>
          </span>
          <Link to="/team" className="transition hover:text-[#111827]">
            Meet the team
          </Link>
        </nav>
        <div className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
          <Link
            to="/login"
            className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-1.5 text-[#111827] transition hover:border-[#cbd5f5] sm:px-4 sm:py-2"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-xl bg-[#5b2ecf] px-3 py-1.5 text-white shadow-[0_12px_28px_rgba(91,46,207,0.25)] transition hover:bg-[#4b25b1] sm:px-4 sm:py-2"
          >
            Free sign up
          </Link>
        </div>
      </div>
      {isMenuOpen && (
        <div
          id="site-nav"
          className="border-t border-[#e5e7eb] bg-white px-4 pb-5 pt-4 md:hidden"
        >
          <div className="flex flex-col gap-4 text-sm font-semibold text-[#6b7280]">
            <span className="flex items-center gap-2 text-[#94a3b8]">
              Features
              <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                Soon
              </span>
            </span>
            <span className="flex items-center gap-2 text-[#94a3b8]">
              Use cases
              <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                Soon
              </span>
            </span>
            <span className="flex items-center gap-2 text-[#94a3b8]">
              Pricing
              <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">
                Soon
              </span>
            </span>
            <Link
              to="/team"
              className="text-[#111827]"
              onClick={() => setIsMenuOpen(false)}
            >
              Meet the team
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
