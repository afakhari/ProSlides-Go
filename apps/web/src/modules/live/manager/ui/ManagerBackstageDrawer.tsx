import { useMemo, useState } from "react";

import type { LivePresentationModel } from "../../model/presentation.ts";
import {
  isContentSlide,
  isQuestionSlide,
} from "../../model/presentationFlow.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { useServerData } from "../../react/useServerData.ts";
import { ManagerLeaderboardDialog } from "./ManagerLeaderboardDialog.tsx";

type ManagerBackstageDrawerProps = {
  quiz: LivePresentationModel;
  currentSlide: number;
};

const itemLabel = (
  slide: LivePresentationModel["slides"][number] | undefined,
): string => {
  if (!slide) return "پایان ارائه";
  if (isQuestionSlide(slide)) {
    return slide.question_text?.trim() || slide.question_title?.trim() || "فعالیت";
  }
  if (isContentSlide(slide)) {
    return slide.title?.trim() || slide.content_text?.trim() || "محتوا";
  }
  return "آیتم";
};

const phaseLabel = (phase: string | null | undefined) => {
  switch (phase) {
    case "accepting":
      return "دریافت پاسخ";
    case "closed":
      return "پاسخ‌گویی بسته";
    case "revealed":
      return "نتیجه آشکار";
    default:
      return "بدون فعالیت فعال";
  }
};

export function ManagerBackstageDrawer({
  quiz,
  currentSlide,
}: ManagerBackstageDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const {
    snapshot,
    isConnected,
    connectionError,
    participantCount,
    loadRoster,
    loadMoreRoster,
    hasMoreRoster,
    isRosterLoading,
  } = useLiveSession();
  const { modalLeaderboardResults } = useServerData();

  const currentItem = useMemo(
    () => itemLabel(quiz.slides[Math.max(0, currentSlide - 1)]),
    [currentSlide, quiz.slides],
  );
  const nextItem = useMemo(
    () => itemLabel(quiz.slides[currentSlide]),
    [currentSlide, quiz.slides],
  );
  const responseCount = Number(snapshot?.activity_result?.response_count ?? 0);
  const stageView =
    snapshot?.session.stage_view === "overall_ranking"
      ? "رتبه‌بندی کلی"
      : "آیتم جاری";

  const openPrivateRanking = () => {
    setShowRanking(true);
    void loadRoster("score", false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed end-4 top-20 z-40 min-h-11 rounded-2xl border border-white/15 bg-slate-950/90 px-4 text-sm font-black text-white shadow-xl backdrop-blur hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        aria-haspopup="dialog"
      >
        پشت‌صحنه
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/55" role="presentation">
          <aside
            dir="rtl"
            className="absolute inset-y-0 end-0 flex w-[min(28rem,92vw)] flex-col overflow-y-auto border-s border-white/10 bg-slate-950 p-5 text-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="backstage-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-white/55">کنترل خصوصی ارائه‌دهنده</p>
                <h2 id="backstage-title" className="mt-1 text-2xl font-black">
                  پشت‌صحنه
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid min-h-11 min-w-11 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="بستن پشت‌صحنه"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs text-white/55">شرکت‌کنندگان</p>
                <p className="mt-1 text-2xl font-black">
                  {Number(participantCount || 0).toLocaleString("fa-IR")}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs text-white/55">پاسخ‌های فعالیت</p>
                <p className="mt-1 text-2xl font-black">
                  {responseCount.toLocaleString("fa-IR")}
                </p>
              </div>
            </div>

            <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-black">وضعیت زنده</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">اتصال</dt>
                  <dd className={isConnected ? "text-success" : "text-warning"}>
                    {isConnected ? "متصل" : "در حال بازیابی"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">Stage</dt>
                  <dd>{stageView}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">فعالیت</dt>
                  <dd>{phaseLabel(snapshot?.session.activity_phase)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">نسخه وضعیت</dt>
                  <dd dir="ltr">{snapshot?.session.state_version ?? "—"}</dd>
                </div>
              </dl>
              {connectionError ? (
                <p className="mt-3 rounded-xl bg-warning/15 p-3 text-xs leading-6 text-warning">
                  ارتباط زنده در حال بازیابی است. فرمان‌ها و snapshot معتبر مستقل از نمایش این پنل باقی می‌مانند.
                </p>
              ) : null}
            </section>

            <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-black">جریان ارائه</h3>
              <div className="mt-3">
                <p className="text-xs text-white/55">آیتم جاری</p>
                <p className="mt-1 line-clamp-2 font-bold" dir="auto">
                  {currentItem}
                </p>
              </div>
              <div className="mt-4">
                <p className="text-xs text-white/55">آیتم بعدی</p>
                <p className="mt-1 line-clamp-2 font-bold" dir="auto">
                  {nextItem}
                </p>
              </div>
            </section>

            {snapshot?.session.id ? (
              <a
                href={`/manager/stage/${snapshot.session.id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 grid min-h-12 place-items-center rounded-2xl border border-white/20 bg-white/10 px-4 text-center font-black text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
              >
                باز کردن Stage در پنجره جدید
              </a>
            ) : null}

            <button
              type="button"
              onClick={openPrivateRanking}
              disabled={snapshot?.has_scoring !== true}
              className="mt-3 min-h-12 rounded-2xl bg-white px-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              مشاهده خصوصی رتبه‌بندی کلی
            </button>
            <p className="mt-2 text-xs leading-6 text-white/50">
              رتبه‌بندی خصوصی Stage را تغییر نمی‌دهد؛ پنجره Stage فقط projection عمومی جلسه را دریافت می‌کند.
            </p>
          </aside>
        </div>
      ) : null}

      <ManagerLeaderboardDialog
        isOpen={showRanking}
        onClose={() => setShowRanking(false)}
        players={modalLeaderboardResults ?? []}
        hasMore={hasMoreRoster}
        isLoading={isRosterLoading}
        onLoadMore={() => void loadMoreRoster()}
      />
    </>
  );
}
