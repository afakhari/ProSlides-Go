import { Trophy } from "lucide-react";

import { formatPersianNumber } from "../../../shared/forms/numbers.ts";
import Notice from "../../../shared/ui/Notice.tsx";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import type { ReportRankingPage } from "../api/reportApi.ts";

interface RankingPanelProps {
  pages: ReportRankingPage[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function RankingPanel({
  pages,
  isLoading,
  isError,
  hasMore,
  loadingMore,
  onLoadMore,
}: RankingPanelProps) {
  const first = pages[0];
  const items = pages.flatMap((page) => page.items);

  return (
    <section className="rounded-panel border border-border-subtle bg-surface shadow-sm">
      <div className="border-b border-border-subtle p-5">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-brand" aria-hidden="true" />
          <h2 className="text-lg font-bold">رتبه‌بندی کلی جلسه</h2>
        </div>
        <p className="mt-1 text-sm text-content-muted">
          این رتبه‌بندی از امتیاز تجمعی کل فعالیت‌های امتیازی محاسبه می‌شود و از
          برترین‌های یک فعالیت جداست.
        </p>
      </div>

      <div className="p-5">
        {isLoading ? (
          <Notice pending>در حال بارگذاری رتبه‌بندی…</Notice>
        ) : isError ? (
          <Notice tone="error">بارگذاری رتبه‌بندی انجام نشد.</Notice>
        ) : first && !first.has_scoring ? (
          <Notice>
            این جلسه فعالیت امتیازی ندارد؛ بنابراین رتبه‌بندی کلی برای آن ساخته
            نمی‌شود.
          </Notice>
        ) : items.length === 0 ? (
          <Notice>هنوز امتیازی برای این جلسه ثبت نشده است.</Notice>
        ) : (
          <>
            <p className="mb-4 text-sm font-semibold text-content-muted">
              {first?.is_final
                ? "رتبه‌بندی نهایی جلسه"
                : "رتبه‌بندی تجمعی تا این لحظه"}
            </p>
            <div className="space-y-2">
              {items.map((entry) => (
                <div
                  key={entry.participant_id}
                  className="flex items-center justify-between gap-4 rounded-control border border-border-subtle bg-surface-raised px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-black text-brand-ink">
                      {formatPersianNumber(entry.rank)}
                    </span>
                    {entry.avatar && (
                      <span aria-hidden="true">{entry.avatar}</span>
                    )}
                    <span className="truncate font-semibold">
                      {entry.display_name}
                    </span>
                  </div>
                  <span className="shrink-0 font-black">
                    {formatPersianNumber(entry.score)} امتیاز
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {hasMore && (
        <div className="border-t border-border-subtle p-4 text-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={loadingMore}
            aria-busy={loadingMore || undefined}
          >
            {loadingMore ? "در حال بارگذاری…" : "نمایش رتبه‌های بیشتر"}
          </Button>
        </div>
      )}
    </section>
  );
}
