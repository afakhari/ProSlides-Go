import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowRight, RefreshCw, Search, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { formatPersianNumber } from "../../../shared/forms/numbers.ts";
import Notice from "../../../shared/ui/Notice.tsx";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import {
  reportLatestSessionQuery,
  reportPresentationQuery,
  reportRosterQuery,
} from "../api/reportQueries.ts";

const cleanDisplayValue = (value: string | undefined, fallback = "") =>
  String(value || fallback).replace(/^"|"$/g, "");

export default function ReportRoute() {
  const { presentationId = "" } = useParams();
  const [searchQuery, setSearchQuery] = useState("");

  const presentationQuery = useQuery({
    ...reportPresentationQuery(presentationId),
    enabled: Boolean(presentationId),
  });
  const sessionQuery = useQuery({
    ...reportLatestSessionQuery(presentationId),
    enabled: Boolean(presentationId),
  });

  const sessionId = sessionQuery.data?.session_id || "";
  const rosterQuery = useInfiniteQuery({
    ...reportRosterQuery(presentationId, sessionId),
    enabled: Boolean(presentationId && sessionId),
  });

  const participants = useMemo(
    () => rosterQuery.data?.pages.flatMap((page) => page.items) || [],
    [rosterQuery.data],
  );

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase("fa-IR");
  const filteredParticipants = useMemo(
    () =>
      participants.filter((participant) =>
        cleanDisplayValue(participant.display_name)
          .toLocaleLowerCase("fa-IR")
          .includes(normalizedSearch),
      ),
    [participants, normalizedSearch],
  );

  const maxScore = useMemo(
    () => Math.max(0, ...participants.map((participant) => participant.score)),
    [participants],
  );

  const hasError =
    presentationQuery.isError || sessionQuery.isError || rosterQuery.isError;
  const isInitialLoading =
    presentationQuery.isPending ||
    sessionQuery.isPending ||
    (Boolean(sessionId) && rosterQuery.isPending);
  const isRefreshing =
    presentationQuery.isFetching ||
    sessionQuery.isFetching ||
    rosterQuery.isFetching;

  const refreshedAt = Math.max(
    presentationQuery.dataUpdatedAt,
    sessionQuery.dataUpdatedAt,
    rosterQuery.dataUpdatedAt,
  );

  const refresh = async () => {
    await Promise.all([
      presentationQuery.refetch(),
      sessionQuery.refetch(),
      sessionId ? rosterQuery.refetch() : Promise.resolve(),
    ]);
  };

  const title = presentationQuery.data?.title?.trim() || "گزارش ارائه";

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 text-content sm:px-6 lg:px-8" dir="rtl">
      <div className="mx-auto max-w-6xl">
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
            <p className="text-xs font-semibold text-content-muted">گزارش ارائه</p>
            <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-content-muted">
              {refreshedAt
                ? `آخرین به‌روزرسانی: ${new Date(refreshedAt).toLocaleTimeString("fa-IR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "داده‌های گزارش هر ۱۵ دقیقه به‌صورت خودکار به‌روزرسانی می‌شوند."}
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
              className={isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}
              aria-hidden="true"
            />
            {isRefreshing ? "در حال به‌روزرسانی…" : "به‌روزرسانی"}
          </Button>
        </header>

        {hasError && (
          <Notice tone="error" className="mb-5">
            بارگذاری گزارش انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.
          </Notice>
        )}

        {isInitialLoading && !hasError ? (
          <section
            className="rounded-panel border border-border-subtle bg-surface p-6 shadow-sm"
            aria-busy="true"
          >
            <Notice pending>در حال بارگذاری گزارش…</Notice>
            <div className="mt-5 h-56 animate-pulse rounded-panel bg-brand-soft motion-reduce:animate-none" />
          </section>
        ) : !hasError && !sessionQuery.data ? (
          <section className="rounded-panel border border-border-subtle bg-surface p-8 text-center shadow-sm">
            <Trophy className="mx-auto size-10 text-content-muted" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-bold">هنوز جلسه‌ای برای این ارائه ثبت نشده است</h2>
            <p className="mt-2 text-sm text-content-muted">
              پس از اجرای ارائه و ورود شرکت‌کنندگان، نتایج اینجا نمایش داده می‌شوند.
            </p>
          </section>
        ) : !hasError ? (
          <section className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-sm">
            <div className="border-b border-border-subtle p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-brand" aria-hidden="true" />
                    <h2 className="text-lg font-bold">شرکت‌کنندگان</h2>
                  </div>
                  <p className="mt-1 text-sm text-content-muted">
                    {normalizedSearch
                      ? `${formatPersianNumber(filteredParticipants.length)} از ${formatPersianNumber(participants.length)} نفر`
                      : `${formatPersianNumber(participants.length)} نفر`}
                  </p>
                </div>

                <label className="relative block w-full sm:max-w-sm">
                  <span className="sr-only">جست‌وجوی شرکت‌کنندگان</span>
                  <Search
                    className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-content-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="جست‌وجوی نام شرکت‌کننده…"
                    className="h-10 w-full rounded-control border border-border-subtle bg-surface ps-10 pe-3 text-sm text-content outline-none placeholder:text-content-muted focus:border-brand-border focus:ring-2 focus:ring-focus"
                  />
                </label>
              </div>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="p-10 text-center">
                <Trophy className="mx-auto size-9 text-content-muted" aria-hidden="true" />
                <p className="mt-3 font-semibold">
                  {normalizedSearch
                    ? "شرکت‌کننده‌ای با این جست‌وجو پیدا نشد."
                    : "هنوز شرکت‌کننده‌ای ثبت نشده است."}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-brand-soft text-content-muted">
                      <tr>
                        <th scope="col" className="px-5 py-3 text-start font-semibold">رتبه</th>
                        <th scope="col" className="px-5 py-3 text-start font-semibold">شرکت‌کننده</th>
                        <th scope="col" className="px-5 py-3 text-start font-semibold">امتیاز</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map((participant) => {
                        const absoluteIndex = participants.findIndex(
                          (item) => item.participant_id === participant.participant_id,
                        );
                        const rank = absoluteIndex + 1;
                        const percentage =
                          maxScore > 0 ? Math.max(0, Math.min(100, (participant.score / maxScore) * 100)) : 0;
                        return (
                          <tr
                            key={participant.participant_id}
                            className="border-t border-border-subtle first:border-t-0"
                          >
                            <td className="px-5 py-4">
                              <span className="inline-flex size-8 items-center justify-center rounded-full border border-brand-border bg-brand-soft font-bold text-brand-ink">
                                {formatPersianNumber(rank)}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                {participant.avatar && (
                                  <span className="text-xl" aria-hidden="true">
                                    {cleanDisplayValue(participant.avatar)}
                                  </span>
                                )}
                                <span className="font-semibold">
                                  {cleanDisplayValue(participant.display_name, "شرکت‌کننده")}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <span className="w-14 shrink-0 font-bold">
                                  {formatPersianNumber(participant.score)}
                                </span>
                                <div
                                  className="h-2 flex-1 overflow-hidden rounded-full bg-brand-soft"
                                  aria-label={`امتیاز نسبی ${Math.round(percentage)} درصد`}
                                >
                                  <div
                                    className="h-full rounded-full bg-brand"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                  {filteredParticipants.map((participant) => {
                    const absoluteIndex = participants.findIndex(
                      (item) => item.participant_id === participant.participant_id,
                    );
                    const rank = absoluteIndex + 1;
                    const percentage =
                      maxScore > 0 ? Math.max(0, Math.min(100, (participant.score / maxScore) * 100)) : 0;
                    return (
                      <article
                        key={participant.participant_id}
                        className="rounded-panel border border-border-subtle bg-surface-raised p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-ink">
                              {formatPersianNumber(rank)}
                            </span>
                            {participant.avatar && (
                              <span aria-hidden="true">{cleanDisplayValue(participant.avatar)}</span>
                            )}
                            <span className="truncate font-semibold">
                              {cleanDisplayValue(participant.display_name, "شرکت‌کننده")}
                            </span>
                          </div>
                          <span className="shrink-0 font-black">
                            {formatPersianNumber(participant.score)} امتیاز
                          </span>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-soft">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}

            {rosterQuery.hasNextPage && (
              <div className="border-t border-border-subtle p-5 text-center">
                <Button
                  variant="outline"
                  onClick={() => void rosterQuery.fetchNextPage()}
                  disabled={rosterQuery.isFetchingNextPage}
                  aria-busy={rosterQuery.isFetchingNextPage || undefined}
                >
                  {rosterQuery.isFetchingNextPage
                    ? "در حال بارگذاری…"
                    : "بارگذاری شرکت‌کنندگان بیشتر"}
                </Button>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
