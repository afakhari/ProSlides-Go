import { CalendarDays, ChevronLeft } from "lucide-react";

import { formatPersianNumber } from "../../../shared/forms/numbers.ts";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import type { ReportSessionSummary } from "../api/reportApi.ts";
import {
  formatReportDateTime,
  sessionStateLabel,
} from "../model/reportView.ts";

interface SessionHistoryProps {
  sessions: ReportSessionSummary[];
  selectedSessionId: string;
  hasMore: boolean;
  loadingMore: boolean;
  onSelect: (sessionId: string) => void;
  onLoadMore: () => void;
}

export function SessionHistory({
  sessions,
  selectedSessionId,
  hasMore,
  loadingMore,
  onSelect,
  onLoadMore,
}: SessionHistoryProps) {
  return (
    <aside
      className="rounded-panel border border-border-subtle bg-surface shadow-sm"
      aria-label="تاریخچه جلسات ارائه"
    >
      <div className="border-b border-border-subtle p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-brand" aria-hidden="true" />
          <h2 className="font-bold">جلسات اجراشده</h2>
        </div>
        <p className="mt-1 text-xs text-content-muted">
          هر جلسه گزارش مستقل و تعریف‌های ثابت‌شده خودش را دارد.
        </p>
      </div>

      <div className="max-h-[36rem] space-y-2 overflow-y-auto p-3">
        {sessions.map((session) => {
          const selected = session.session_id === selectedSessionId;
          return (
            <button
              key={session.session_id}
              type="button"
              onClick={() => onSelect(session.session_id)}
              aria-current={selected ? "true" : undefined}
              className={[
                "w-full rounded-control border p-3 text-start transition",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                selected
                  ? "border-brand-border bg-brand-soft"
                  : "border-border-subtle bg-surface-raised hover:border-brand-border",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {formatReportDateTime(session.created_at)}
                  </p>
                  <p className="mt-1 text-xs text-content-muted">
                    {sessionStateLabel(session.state)}
                  </p>
                </div>
                <ChevronLeft
                  className="mt-1 size-4 shrink-0 text-content-muted"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-content-muted">
                <span>
                  {formatPersianNumber(session.participant_count)} شرکت‌کننده
                </span>
                <span>
                  {formatPersianNumber(session.activity_count)} فعالیت
                </span>
                <span>
                  {formatPersianNumber(session.response_count)} پاسخ
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {hasMore && (
        <div className="border-t border-border-subtle p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onLoadMore}
            disabled={loadingMore}
            aria-busy={loadingMore || undefined}
          >
            {loadingMore ? "در حال بارگذاری…" : "نمایش جلسات قدیمی‌تر"}
          </Button>
        </div>
      )}
    </aside>
  );
}
