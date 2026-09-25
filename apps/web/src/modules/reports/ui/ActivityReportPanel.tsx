import { CheckCircle2, CircleX, Medal, UsersRound } from "lucide-react";

import { formatPersianNumber } from "../../../shared/forms/numbers.ts";
import Notice from "../../../shared/ui/Notice.tsx";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import type {
  ReportActivityPage,
  ReportActivitySummary,
} from "../api/reportApi.ts";
import {
  activityPrompt,
  activityTitle,
  choiceOptions,
  formatReportDateTime,
  responseLabels,
} from "../model/reportView.ts";

interface ActivityReportPanelProps {
  activity: ReportActivitySummary;
  pages: ReportActivityPage[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function ActivityReportPanel({
  activity,
  pages,
  isLoading,
  isError,
  hasMore,
  loadingMore,
  onLoadMore,
}: ActivityReportPanelProps) {
  const first = pages[0];
  const responses = pages.flatMap((page) => page.responses);
  const options = choiceOptions(activity);
  const maxCount = Math.max(
    1,
    ...options.map((option) => first?.result.payload.option_counts[option.id] ?? 0),
  );

  if (isLoading) {
    return (
      <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-sm">
        <Notice pending>در حال بارگذاری نتیجه فعالیت…</Notice>
      </section>
    );
  }

  if (isError || !first) {
    return (
      <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-sm">
        <Notice tone="error">بارگذاری نتیجه این فعالیت انجام نشد.</Notice>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-sm">
      <div className="border-b border-border-subtle p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black">{activityTitle(activity)}</h2>
          {activity.scored && (
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-ink">
              امتیازی
            </span>
          )}
        </div>
        {activityPrompt(activity) && (
          <p className="mt-2 text-sm text-content-muted">
            {activityPrompt(activity)}
          </p>
        )}
        <p className="mt-3 text-sm font-semibold text-content-muted">
          {formatPersianNumber(first.result.response_count)} پاسخ ثبت‌شده
        </p>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
        <div>
          <h3 className="font-bold">نتیجه همین فعالیت</h3>
          <p className="mt-1 text-xs text-content-muted">
            توزیع پاسخ‌ها فقط برای این فعالیت است و با رتبه‌بندی کلی جلسه ترکیب
            نمی‌شود.
          </p>
          <div className="mt-4 space-y-3">
            {options.map((option) => {
              const count = first.result.payload.option_counts[option.id] ?? 0;
              const width = Math.round((count / maxCount) * 100);
              return (
                <div key={option.id}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold">
                      {option.text?.trim() || option.id}
                    </span>
                    <span className="shrink-0 text-content-muted">
                      {formatPersianNumber(count)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-brand-soft"
                    aria-label={`${formatPersianNumber(count)} پاسخ`}
                  >
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <Medal className="size-5 text-brand" aria-hidden="true" />
            <h3 className="font-bold">برترین‌های همین فعالیت</h3>
          </div>
          {!activity.scored ? (
            <p className="mt-3 text-sm text-content-muted">
              این فعالیت امتیازی نیست و برترین عملکرد برای آن تعریف نمی‌شود.
            </p>
          ) : first.top_performers.length === 0 ? (
            <p className="mt-3 text-sm text-content-muted">
              هنوز پاسخ امتیازی ثبت نشده است.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {first.top_performers.map((performer) => (
                <div
                  key={performer.participant_id}
                  className="flex items-center justify-between gap-3 rounded-control bg-surface-raised px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-semibold">
                    {formatPersianNumber(performer.rank)}.{" "}
                    {performer.display_name}
                  </span>
                  <span className="shrink-0 font-bold">
                    +{formatPersianNumber(performer.score_delta)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border-subtle">
        <div className="flex items-center gap-2 px-5 pt-5">
          <UsersRound className="size-5 text-brand" aria-hidden="true" />
          <h3 className="font-bold">پاسخ‌ها و ارزیابی شرکت‌کنندگان</h3>
        </div>

        {responses.length === 0 ? (
          <p className="p-5 text-sm text-content-muted">
            برای این فعالیت پاسخی ثبت نشده است.
          </p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {responses.map((response) => {
              const labels = responseLabels(activity, response);
              const correctness = response.evaluation.correct;
              return (
                <article
                  key={response.answer_id}
                  className="grid gap-3 p-5 md:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {response.avatar && (
                        <span aria-hidden="true">{response.avatar}</span>
                      )}
                      <h4 className="truncate font-bold">
                        {response.display_name}
                      </h4>
                    </div>
                    <p className="mt-2 text-sm text-content-muted">
                      پاسخ: {labels.length > 0 ? labels.join("، ") : "بدون انتخاب"}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                      {formatReportDateTime(response.submitted_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 md:justify-end">
                    {correctness !== undefined && correctness !== null && (
                      <span
                        className="inline-flex items-center gap-1 text-sm font-semibold"
                        aria-label={correctness ? "پاسخ درست" : "پاسخ نادرست"}
                      >
                        {correctness ? (
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                        ) : (
                          <CircleX className="size-4" aria-hidden="true" />
                        )}
                        {correctness ? "درست" : "نادرست"}
                      </span>
                    )}
                    {activity.scored && (
                      <span className="rounded-full bg-brand-soft px-2.5 py-1 text-sm font-black text-brand-ink">
                        +{formatPersianNumber(response.evaluation.score_delta)}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
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
            {loadingMore ? "در حال بارگذاری…" : "نمایش پاسخ‌های بیشتر"}
          </Button>
        </div>
      )}
    </section>
  );
}
