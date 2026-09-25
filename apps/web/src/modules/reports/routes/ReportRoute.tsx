import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  MessageSquareText,
  RefreshCw,
  Users,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { formatPersianNumber } from "../../../shared/forms/numbers.ts";
import Notice from "../../../shared/ui/Notice.tsx";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import {
  reportActivityQuery,
  reportRankingQuery,
  reportSessionQuery,
  reportSessionsQuery,
} from "../api/reportQueries.ts";
import {
  activityTitle,
  formatReportDateTime,
  sessionStateLabel,
} from "../model/reportView.ts";
import { ActivityReportPanel } from "../ui/ActivityReportPanel.tsx";
import { RankingPanel } from "../ui/RankingPanel.tsx";
import { SessionHistory } from "../ui/SessionHistory.tsx";

export default function ReportRoute() {
  const { presentationId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSessionParam = searchParams.get("session") || "";
  const selectedActivityParam = searchParams.get("activity") || "";

  const sessionsQuery = useInfiniteQuery({
    ...reportSessionsQuery(presentationId),
    enabled: Boolean(presentationId),
  });

  const sessions = useMemo(
    () => sessionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [sessionsQuery.data],
  );

  const requestedSessionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    selectedSessionParam,
  )
    ? selectedSessionParam
    : "";
  const selectedSessionId =
    requestedSessionId || sessions[0]?.session_id || "";

  const sessionQuery = useQuery({
    ...reportSessionQuery(presentationId, selectedSessionId),
    enabled: Boolean(presentationId && selectedSessionId),
  });

  const activities = sessionQuery.data?.activities ?? [];
  const selectedActivityId = activities.some(
    (activity) => activity.activity_item_id === selectedActivityParam,
  )
    ? selectedActivityParam
    : activities[0]?.activity_item_id || "";

  const activityQuery = useInfiniteQuery({
    ...reportActivityQuery(
      presentationId,
      selectedSessionId,
      selectedActivityId,
    ),
    enabled: Boolean(
      presentationId && selectedSessionId && selectedActivityId,
    ),
  });

  const rankingQuery = useInfiniteQuery({
    ...reportRankingQuery(presentationId, selectedSessionId),
    enabled: Boolean(presentationId && selectedSessionId),
  });

  useEffect(() => {
    if (!selectedSessionId || selectedSessionParam === selectedSessionId) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("session", selectedSessionId);
        next.delete("activity");
        return next;
      },
      { replace: true },
    );
  }, [
    selectedSessionId,
    selectedSessionParam,
    setSearchParams,
  ]);

  useEffect(() => {
    if (
      !selectedActivityId ||
      selectedActivityParam === selectedActivityId
    ) {
      return;
    }
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("activity", selectedActivityId);
        return next;
      },
      { replace: true },
    );
  }, [
    selectedActivityId,
    selectedActivityParam,
    setSearchParams,
  ]);

  const selectSession = (sessionId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("session", sessionId);
      next.delete("activity");
      return next;
    });
  };

  const selectActivity = (activityItemId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("activity", activityItemId);
      return next;
    });
  };

  const refresh = async () => {
    await Promise.all([
      sessionsQuery.refetch(),
      selectedSessionId ? sessionQuery.refetch() : Promise.resolve(),
      selectedActivityId ? activityQuery.refetch() : Promise.resolve(),
      selectedSessionId ? rankingQuery.refetch() : Promise.resolve(),
    ]);
  };

  const selectedActivity = activities.find(
    (activity) => activity.activity_item_id === selectedActivityId,
  );
  const summary = sessionQuery.data?.session;
  const hasInitialError =
    sessionsQuery.isError ||
    (Boolean(selectedSessionId) && sessionQuery.isError);
  const isInitialLoading =
    sessionsQuery.isPending ||
    (Boolean(selectedSessionId) && sessionQuery.isPending);
  const isRefreshing =
    sessionsQuery.isFetching ||
    sessionQuery.isFetching ||
    activityQuery.isFetching ||
    rankingQuery.isFetching;

  return (
    <main
      className="min-h-screen bg-canvas px-4 py-6 text-content sm:px-6 lg:px-8"
      dir="rtl"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-panel border border-border-subtle bg-surface-raised p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link
              to="/manager/panel"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label="بازگشت به پنل مدیریت"
            >
              <ArrowRight className="size-4" aria-hidden="true" />
              بازگشت به پنل مدیریت
            </Link>
            <p className="text-xs font-semibold text-content-muted">
              گزارش جلسه‌محور
            </p>
            <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl" dir="auto">
              {summary?.presentation_title || "گزارش ارائه"}
            </h1>
            <p className="mt-2 text-sm text-content-muted">
              هر اجرا مستقل نگه داشته می‌شود؛ نتایج تاریخی از تعریف ثابت‌شده
              همان جلسه خوانده می‌شوند.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            aria-busy={isRefreshing || undefined}
            className="self-start sm:self-auto"
          >
            <RefreshCw
              className={
                isRefreshing
                  ? "animate-spin motion-reduce:animate-none"
                  : ""
              }
              aria-hidden="true"
            />
            {isRefreshing ? "در حال به‌روزرسانی…" : "به‌روزرسانی"}
          </Button>
        </header>

        {hasInitialError && (
          <Notice tone="error" className="mb-5">
            بارگذاری گزارش انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش
            کنید.
          </Notice>
        )}

        {isInitialLoading && !hasInitialError ? (
          <section
            className="rounded-panel border border-border-subtle bg-surface p-6 shadow-sm"
            aria-busy="true"
          >
            <Notice pending>در حال بارگذاری تاریخچه گزارش…</Notice>
            <div className="mt-5 h-56 animate-pulse rounded-panel bg-brand-soft motion-reduce:animate-none" />
          </section>
        ) : !hasInitialError && sessions.length === 0 ? (
          <section className="rounded-panel border border-border-subtle bg-surface p-8 text-center shadow-sm">
            <BarChart3
              className="mx-auto size-10 text-content-muted"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-bold">
              هنوز جلسه‌ای برای این ارائه ثبت نشده است
            </h2>
            <p className="mt-2 text-sm text-content-muted">
              با اجرای ارائه، هر جلسه به‌صورت مستقل در این تاریخچه قرار می‌گیرد.
            </p>
          </section>
        ) : !hasInitialError && summary ? (
          <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <SessionHistory
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              hasMore={Boolean(sessionsQuery.hasNextPage)}
              loadingMore={sessionsQuery.isFetchingNextPage}
              onSelect={selectSession}
              onLoadMore={() => void sessionsQuery.fetchNextPage()}
            />

            <div className="min-w-0 space-y-5">
              <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-content-muted">
                      جلسه انتخاب‌شده
                    </p>
                    <h2 className="mt-1 text-xl font-black">
                      {formatReportDateTime(summary.created_at)}
                    </h2>
                    <p className="mt-1 text-sm text-content-muted">
                      {sessionStateLabel(summary.state)}
                      {summary.ended_at
                        ? ` · پایان ${formatReportDateTime(summary.ended_at)}`
                        : ""}
                    </p>
                  </div>
                  <span className="self-start rounded-full border border-border-subtle bg-surface-raised px-3 py-1 text-xs font-bold">
                    {summary.has_scoring
                      ? "دارای امتیازدهی"
                      : "بدون امتیازدهی"}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-control bg-surface-raised p-4">
                    <Users
                      className="size-5 text-brand"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-2xl font-black">
                      {formatPersianNumber(summary.participant_count)}
                    </p>
                    <p className="text-sm text-content-muted">
                      شرکت‌کننده
                    </p>
                  </div>
                  <div className="rounded-control bg-surface-raised p-4">
                    <Activity
                      className="size-5 text-brand"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-2xl font-black">
                      {formatPersianNumber(summary.activity_count)}
                    </p>
                    <p className="text-sm text-content-muted">فعالیت</p>
                  </div>
                  <div className="rounded-control bg-surface-raised p-4">
                    <MessageSquareText
                      className="size-5 text-brand"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-2xl font-black">
                      {formatPersianNumber(summary.response_count)}
                    </p>
                    <p className="text-sm text-content-muted">
                      پاسخ پذیرفته‌شده
                    </p>
                  </div>
                </div>
              </section>

              {activities.length > 0 ? (
                <section className="rounded-panel border border-border-subtle bg-surface p-4 shadow-sm">
                  <h2 className="px-1 text-sm font-bold text-content-muted">
                    فعالیت‌های جلسه
                  </h2>
                  <div
                    className="mt-3 flex gap-2 overflow-x-auto pb-1"
                    role="group"
                    aria-label="انتخاب فعالیت گزارش"
                  >
                    {activities.map((activity) => {
                      const selected =
                        activity.activity_item_id === selectedActivityId;
                      return (
                        <button
                          key={activity.activity_item_id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            selectActivity(activity.activity_item_id)
                          }
                          className={[
                            "min-w-[12rem] rounded-control border px-4 py-3 text-start",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                            selected
                              ? "border-brand-border bg-brand-soft"
                              : "border-border-subtle bg-surface-raised hover:border-brand-border",
                          ].join(" ")}
                        >
                          <span className="block truncate text-sm font-bold" dir="auto">
                            {activityTitle(activity)}
                          </span>
                          <span className="mt-1 block text-xs text-content-muted">
                            {formatPersianNumber(activity.response_count)} پاسخ
                            {activity.scored ? " · امتیازی" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <Notice>
                  در تعریف ثابت‌شده این جلسه فعالیت تعاملی وجود ندارد.
                </Notice>
              )}

              {selectedActivity && (
                <ActivityReportPanel
                  activity={selectedActivity}
                  pages={activityQuery.data?.pages ?? []}
                  isLoading={activityQuery.isPending}
                  isError={activityQuery.isError}
                  hasMore={Boolean(activityQuery.hasNextPage)}
                  loadingMore={activityQuery.isFetchingNextPage}
                  onLoadMore={() => void activityQuery.fetchNextPage()}
                />
              )}

              <RankingPanel
                pages={rankingQuery.data?.pages ?? []}
                isLoading={rankingQuery.isPending}
                isError={rankingQuery.isError}
                hasMore={Boolean(rankingQuery.hasNextPage)}
                loadingMore={rankingQuery.isFetchingNextPage}
                onLoadMore={() => void rankingQuery.fetchNextPage()}
              />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
