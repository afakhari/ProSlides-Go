import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";

import { getColorForUser } from "../../../../shared/lib/playerColor.ts";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
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
  onAdvance: () => void;
  onEndGame: () => void;
};

type PrimaryControl =
  | { kind: "start"; label: string }
  | { kind: "close"; label: string }
  | { kind: "reveal"; label: string }
  | { kind: "ranking"; label: string }
  | { kind: "next"; label: string }
  | { kind: "end"; label: string }
  | { kind: "disabled"; label: string };

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
  onAdvance,
  onEndGame,
}: ManagerBackstageDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [commandPending, setCommandPending] = useState(false);
  const [commandError, setCommandError] = useState("");
  const {
    snapshot,
    isConnected,
    connectionError,
    participantCount,
    sendNavigation,
    sendManagerAction,
    sendEnd,
    loadRoster,
    loadMoreRoster,
    hasMoreRoster,
    isRosterLoading,
  } = useLiveSession();
  const {
    modalLeaderboardResults,
    currentQuestion,
    questionResults,
  } = useServerData();

  const managerSnapshot = snapshot?.role === "manager" ? snapshot : null;
  const session = managerSnapshot?.session ?? null;
  const currentIndex = Math.max(0, currentSlide - 1);
  const nextSlide = quiz.slides[currentSlide] ?? null;
  const firstSlide = quiz.slides.find((slide) => slide !== null) ?? null;

  const currentItem = useMemo(
    () => itemLabel(quiz.slides[currentIndex]),
    [currentIndex, quiz.slides],
  );
  const nextItem = useMemo(
    () => itemLabel(quiz.slides[currentSlide]),
    [currentSlide, quiz.slides],
  );

  const resultMatches =
    currentQuestion?.question_id != null &&
    questionResults?.question_id != null &&
    String(currentQuestion.question_id) === String(questionResults.question_id);
  const resultRows = resultMatches ? questionResults?.optionsResult ?? [] : [];
  const wordTerms = resultMatches ? questionResults?.wordTerms ?? [] : [];
  const maxWordCount = Math.max(
    1,
    ...wordTerms.map((term) => Math.max(0, Number(term.count))),
  );
  const isWordCloud = currentQuestion?.activity_kind === "text";
  const responseCount = Number(
    resultMatches
      ? questionResults?.response_count ?? managerSnapshot?.activity_result?.response_count ?? 0
      : managerSnapshot?.activity_result?.response_count ?? 0,
  );
  const activityResultVisible =
    session?.activity_phase === "closed" ||
    session?.activity_phase === "revealed";
  const topPerformers = managerSnapshot?.activity_top_performers ?? [];

  const stageView =
    session?.stage_view === "overall_ranking"
      ? "رتبه‌بندی کلی"
      : "آیتم جاری";

  const primaryControl = useMemo<PrimaryControl>(() => {
    if (!session || commandPending) {
      return { kind: "disabled", label: commandPending ? "در حال اعمال…" : "در انتظار جلسه" };
    }
    if (session.state === "ended") {
      return { kind: "disabled", label: "جلسه پایان یافته" };
    }
    if (session.state === "draft" || session.state === "lobby") {
      return firstSlide
        ? { kind: "start", label: "شروع ارائه و باز کردن اولین آیتم" }
        : { kind: "disabled", label: "آیتمی برای اجرا وجود ندارد" };
    }
    if (session.activity_phase === "accepting") {
      return { kind: "close", label: "بستن پاسخ‌گویی" };
    }
    if (session.activity_phase === "closed") {
      return { kind: "reveal", label: "نمایش نتیجه روی Stage" };
    }
    if (
      session.activity_phase === "revealed" &&
      session.stage_view === "item" &&
      currentQuestion?.is_scored !== false &&
      currentQuestion?.show_leaderboard_after === true
    ) {
      return { kind: "ranking", label: "نمایش رتبه‌بندی کلی روی Stage" };
    }
    if (nextSlide) {
      return { kind: "next", label: "باز کردن آیتم بعدی" };
    }
    return { kind: "end", label: "پایان جلسه" };
  }, [
    commandPending,
    currentQuestion?.is_scored,
    currentQuestion?.show_leaderboard_after,
    firstSlide,
    nextSlide,
    session,
  ]);

  const runPrimaryControl = async () => {
    setCommandError("");
    if (primaryControl.kind === "disabled") return;
    if (primaryControl.kind === "end") {
      setConfirmEnd(true);
      return;
    }

    setCommandPending(true);
    try {
      let applied = false;
      switch (primaryControl.kind) {
        case "start":
          applied = firstSlide
            ? await sendNavigation("start", { slide: firstSlide })
            : false;
          if (applied) onAdvance();
          break;
        case "close":
          applied = await sendManagerAction("close_activity");
          break;
        case "reveal":
          applied = await sendManagerAction("reveal_activity");
          break;
        case "ranking":
          applied = await sendManagerAction("show_overall_ranking");
          break;
        case "next":
          applied = nextSlide
            ? await sendNavigation("next", { slide: nextSlide })
            : false;
          if (applied) onAdvance();
          break;
      }
      if (!applied) {
        setCommandError(
          "فرمان تأیید نشد. وضعیت جلسه از snapshot معتبر بازیابی می‌شود؛ دوباره تلاش کنید.",
        );
      }
    } finally {
      setCommandPending(false);
    }
  };

  const finishSession = async () => {
    setCommandError("");
    setCommandPending(true);
    try {
      const ended = await sendEnd();
      if (ended) {
        setConfirmEnd(false);
        onEndGame();
      } else {
        setCommandError("پایان جلسه تأیید نشد. وضعیت اتصال را بررسی کنید.");
      }
    } finally {
      setCommandPending(false);
    }
  };

  const openPrivateRanking = () => {
    setShowRanking(true);
    void loadRoster("score", false);
  };

  return (
    <>
      <DialogPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <DialogPrimitive.Trigger asChild>
          <button
            type="button"
            className="fixed end-4 top-20 z-40 min-h-11 rounded-2xl border border-white/15 bg-slate-950/90 px-4 text-sm font-black text-white shadow-xl backdrop-blur hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            پشت‌صحنه
          </button>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/55" />
          <DialogPrimitive.Content
            dir="rtl"
            className="fixed inset-y-0 end-0 z-[61] flex w-[min(36rem,94vw)] flex-col overflow-y-auto border-0 border-s border-white/10 bg-slate-950 p-5 text-white shadow-2xl outline-none"
            aria-labelledby="backstage-title"
            onPointerDownOutside={(event) => event.preventDefault()}
            data-backstage-surface="presenter"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-white/55">کنترل خصوصی ارائه‌دهنده</p>
                <DialogPrimitive.Title asChild>
                  <h2 id="backstage-title" className="mt-1 text-2xl font-black">
                    پشت‌صحنه
                  </h2>
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">
                  کنترل خصوصی ارائه، وضعیت اتصال، نتایج فعالیت و رتبه‌بندی جلسه.
                </DialogPrimitive.Description>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="grid min-h-11 min-w-11 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label="بستن پشت‌صحنه"
                >
                  ×
                </button>
              </DialogPrimitive.Close>
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
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">کنترل اجرا</h3>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60">
                  {stageView}
                </span>
              </div>

              <div className="mt-4 rounded-2xl bg-black/20 p-4">
                <p className="text-xs text-white/50">آیتم جاری</p>
                <p className="mt-1 line-clamp-2 font-black" dir="auto">
                  {currentItem}
                </p>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-xs text-white/50">آیتم بعدی</p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-white/80" dir="auto">
                    {nextItem}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void runPrimaryControl()}
                disabled={primaryControl.kind === "disabled" || commandPending}
                className="mt-4 min-h-12 w-full rounded-2xl bg-brand px-4 font-black text-content-inverse hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/25"
              >
                {primaryControl.label}
              </button>
              <p className="mt-2 text-xs leading-6 text-white/50">
                هر فرمان با state version فعلی ارسال می‌شود؛ وضعیت Stage فقط پس از تأیید سرور تغییر می‌کند.
              </p>
              {commandError ? (
                <p className="mt-3 rounded-xl bg-danger/15 p-3 text-xs leading-6 text-danger" role="alert">
                  {commandError}
                </p>
              ) : null}
            </section>

            <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-sm font-black">وضعیت زنده و بازیابی</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">اتصال</dt>
                  <dd className={isConnected ? "text-success" : "text-warning"}>
                    {isConnected ? "متصل" : "در حال بازیابی"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">فعالیت</dt>
                  <dd>{phaseLabel(session?.activity_phase)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">نسخه وضعیت</dt>
                  <dd dir="ltr">{session?.state_version ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/55">آخرین رویداد</dt>
                  <dd dir="ltr">{managerSnapshot?.last_event_id ?? "—"}</dd>
                </div>
              </dl>
              {connectionError ? (
                <p className="mt-3 rounded-xl bg-warning/15 p-3 text-xs leading-6 text-warning" role="status">
                  ارتباط زنده در حال بازیابی است. snapshot معتبر قبل از ادامه event stream دوباره خوانده می‌شود.
                </p>
              ) : null}
            </section>

            {activityResultVisible && currentQuestion ? (
              <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black">نتیجه خصوصی فعالیت</h3>
                  <span className="text-xs text-white/55">
                    {responseCount.toLocaleString("fa-IR")} پاسخ
                  </span>
                </div>
                {isWordCloud ? (
                  <div
                    className="mt-3 flex min-h-32 flex-wrap items-center justify-center gap-x-4 gap-y-3 rounded-2xl bg-black/20 p-4"
                    aria-label="پیش‌نمایش خصوصی ابر واژه"
                  >
                    {wordTerms.length === 0 ? (
                      <p className="text-xs text-white/50">
                        هنوز واژه‌ای برای نمایش وجود ندارد.
                      </p>
                    ) : (
                      wordTerms.map((term) => {
                        const ratio = Math.max(
                          0.35,
                          Number(term.count) / maxWordCount,
                        );
                        return (
                          <span
                            key={term.text}
                            dir="auto"
                            className="font-black leading-none"
                            style={{ fontSize: 13 + Math.round(ratio * 18) }}
                            aria-label={
                              term.text +
                              "، " +
                              Number(term.count).toLocaleString("fa-IR") +
                              " بار"
                            }
                          >
                            {term.text}
                          </span>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {(currentQuestion.options ?? []).map((option, index) => {
                      const count = Number(
                        resultRows.find(
                          (row) => Number(row.option_id) === index,
                        )?.number_of_submits ?? 0,
                      );
                      const correct =
                        currentQuestion.has_correct_answer !== false &&
                        option.answer === true;
                      return (
                        <div
                          key={String(option.option_id ?? index)}
                          className="flex min-h-11 items-center gap-3 rounded-xl bg-black/20 px-3 py-2"
                        >
                          <span
                            className={
                              "h-2.5 w-2.5 shrink-0 rounded-full " +
                              (correct ? "bg-success" : "bg-white/30")
                            }
                            aria-hidden="true"
                          />
                          <span
                            className="min-w-0 flex-1 truncate text-sm font-bold"
                            dir="auto"
                          >
                            {option.option_text}
                          </span>
                          {correct ? (
                            <span className="text-xs font-bold text-success">
                              صحیح
                            </span>
                          ) : null}
                          <strong className="text-sm">
                            {count.toLocaleString("fa-IR")}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {activityResultVisible && currentQuestion?.is_scored !== false ? (
              <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-black">برترین‌های این فعالیت</h3>
                <p className="mt-1 text-xs leading-6 text-white/50">
                  این رتبه فقط عملکرد همین فعالیت را نشان می‌دهد و با رتبه‌بندی کلی جلسه متفاوت است.
                </p>
                {topPerformers.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {topPerformers.map((performer) => (
                      <li
                        key={performer.participant_id}
                        className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-black/20 px-3 py-2"
                      >
                        <span
                          className="grid h-8 w-8 place-items-center rounded-full text-xs font-black text-white"
                          style={{ backgroundColor: getColorForUser(performer.participant_id) }}
                        >
                          {performer.rank.toLocaleString("fa-IR")}
                        </span>
                        <span className="min-w-0 truncate text-sm font-bold" dir="auto">
                          {performer.avatar ? `${performer.avatar} ` : ""}
                          {performer.display_name}
                        </span>
                        <strong className="text-xs">
                          +{Math.round(performer.score_delta).toLocaleString("fa-IR")}
                        </strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 rounded-xl bg-black/20 p-3 text-center text-xs text-white/55">
                    هنوز عملکرد امتیازی ثبت نشده است.
                  </p>
                )}
              </section>
            ) : null}

            {session?.id ? (
              <a
                href={`/manager/stage/${session.id}`}
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
              disabled={managerSnapshot?.has_scoring !== true}
              className="mt-3 min-h-12 rounded-2xl bg-white px-4 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              مشاهده خصوصی رتبه‌بندی کلی
            </button>
            <p className="mt-2 text-xs leading-6 text-white/50">
              رتبه‌بندی خصوصی Stage را تغییر نمی‌دهد و از roster محدود manager خوانده می‌شود.
            </p>

            {session?.state !== "ended" && primaryControl.kind !== "end" ? (
              <button
                type="button"
                onClick={() => setConfirmEnd(true)}
                disabled={commandPending}
                className="mt-5 min-h-11 rounded-xl border border-danger/40 bg-danger/10 px-4 text-sm font-bold text-danger hover:bg-danger/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60"
              >
                پایان جلسه
              </button>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ManagerLeaderboardDialog
        isOpen={showRanking}
        onClose={() => setShowRanking(false)}
        players={modalLeaderboardResults ?? []}
        hasMore={hasMoreRoster}
        isLoading={isRosterLoading}
        onLoadMore={() => void loadMoreRoster()}
      />

      <ConfirmDialog
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={finishSession}
        title="پایان جلسه؟"
        description="جلسه برای شرکت‌کنندگان پایان می‌یابد و Stage به نتیجه نهایی می‌رود."
        confirmText="پایان جلسه"
        cancelText="ادامه ارائه"
        confirmVariant="destructive"
        isLoading={commandPending}
      />
    </>
  );
}
