import { Search, X } from "lucide-react";
import { useState } from "react";

import { ManagerAccountMenu } from "../../../identity/public.ts";

type DashboardHeaderProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onBeforeAccountOpen?: () => void;
};

function SearchField({
  value,
  onChange,
  mobile = false,
}: {
  value: string;
  onChange: (value: string) => void;
  mobile?: boolean;
}) {
  return (
    <div className="relative">
      <Search
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-content-muted ${
          mobile ? "start-3 h-4 w-4" : "start-4 h-5 w-5"
        }`}
        aria-hidden="true"
      />
      <input
        type="search"
        placeholder="جست‌وجوی ارائه‌ها"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onChange("");
            event.currentTarget.blur();
          }
        }}
        aria-label="جست‌وجوی ارائه‌ها"
        autoFocus={mobile}
        className={`w-full rounded-control border border-border-subtle bg-canvas text-content transition-colors placeholder:text-content-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus ${
          mobile ? "py-2 pe-10 ps-10 text-sm" : "py-2.5 pe-10 ps-12"
        }`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute end-2 top-1/2 inline-flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-lg text-content-muted transition-colors hover:bg-brand-soft hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="پاک کردن جست‌وجو"
          title="پاک کردن جست‌وجو"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export function DashboardHeader({
  searchQuery,
  onSearchQueryChange,
  onBeforeAccountOpen,
}: DashboardHeaderProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const prepareAccountMenu = () => {
    setMobileSearchOpen(false);
    onBeforeAccountOpen?.();
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 w-full border-b border-brand-border bg-surface/95 shadow-sm backdrop-blur">
      <div className="md:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div
            className="flex items-center gap-1.5 font-brand text-lg font-bold text-brand-ink before:text-xl before:text-brand before:content-['✱']"
            dir="ltr"
          >
            ProSlides
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((open) => !open)}
              className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                mobileSearchOpen
                  ? "bg-brand-muted text-brand"
                  : "text-content-muted hover:bg-canvas hover:text-content"
              }`}
              aria-label="نمایش جست‌وجو"
              aria-expanded={mobileSearchOpen}
              aria-controls="dashboard-mobile-search"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
            <ManagerAccountMenu compact onBeforeOpen={prepareAccountMenu} />
          </div>
        </div>

        {mobileSearchOpen ? (
          <div
            id="dashboard-mobile-search"
            className="border-t border-border-subtle bg-canvas px-4 py-2 motion-safe:animate-in motion-safe:slide-in-from-top"
          >
            <SearchField
              value={searchQuery}
              onChange={onSearchQueryChange}
              mobile
            />
          </div>
        ) : null}
      </div>

      <div className="hidden items-center justify-between px-6 py-3 md:flex">
        <div
          className="flex items-center gap-1.5 font-brand text-lg font-bold text-brand-ink before:text-xl before:text-brand before:content-['✱']"
          dir="ltr"
        >
          ProSlides
        </div>

        <div className="mx-8 max-w-md flex-1">
          <SearchField
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
        </div>

        <ManagerAccountMenu onBeforeOpen={prepareAccountMenu} />
      </div>
    </header>
  );
}
