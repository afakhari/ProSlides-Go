import { useMemo, useState } from "react";

import Notice from "../../../../shared/ui/Notice.tsx";
import { getColorForUser } from "../../../../shared/lib/playerColor.ts";
import { isQuestionSlide } from "../../model/presentationFlow.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { useServerData } from "../../react/useServerData.ts";
import { ManagerQrPanel } from "./ManagerQrPanel.tsx";
import { ManagerTopBar } from "./ManagerTopBar.tsx";
import type { LivePresentationModel } from "../../model/presentation.ts";

type ManagerJoinPageProps = {
  roomId?: string;
  onNext: () => void;
  quiz: LivePresentationModel;
};

export function ManagerJoinPage({
  onNext,
  quiz,
}: ManagerJoinPageProps) {
  const {
    isConnected,
    connectionError,
    sendNavigation,
    participantCount,
    hasMoreRoster,
    isRosterLoading,
    loadMoreRoster,
  } = useLiveSession();
  const { users, currentQuestion, currentContent, leaderboardResults } =
    useServerData();
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [showQr, setShowQr] = useState(false);
  const [startError, setStartError] = useState("");

  const sessionInProgress =
    currentQuestion !== null ||
    currentContent !== null ||
    (leaderboardResults?.length ?? 0) > 0;

  const invalidQuestion = useMemo(
    () =>
      quiz.slides.find((slide) => {
        if (!isQuestionSlide(slide)) return false;
        const options = Array.isArray(slide.options) ? slide.options : [];
        const correct = options.filter((option) => option.answer === true).length;
        const title = String(slide.question_text ?? "").trim();

        return (
          !title ||
          options.length < 2 ||
          correct < 1 ||
          (slide.question_type === "single" && correct !== 1)
        );
      }),
    [quiz.slides],
  );

  const toggleName = (userId: string) => {
    setHiddenUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleStart = async () => {
    setStartError("");

    if (quiz.slides.length === 0) {
      setStartError("این ارائه اسلایدی برای شروع ندارد.");
      return;
    }
    if (invalidQuestion) {
      setStartError(
        "پیش از اجرا، هر سؤال باید متن، حداقل دو گزینه و پاسخ صحیح معتبر داشته باشد.",
      );
      return;
    }
    if (sessionInProgress) {
      onNext();
      return;
    }
    if (!isConnected) {
      setStartError("اتصال جلسه هنوز آماده نیست. دوباره تلاش کنید.");
      return;
    }

    const started = await sendNavigation("start", {
      slide: quiz.slides[0],
    });
    if (!started) {
      setStartError("شروع جلسه تأیید نشد. وضعیت اتصال را بررسی کنید.");
      return;
    }
    onNext();
  };

  const theme = participantTheme(quiz);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-cover bg-center text-[color:var(--live-fg)]"
      style={theme.style}
    >
      <ManagerTopBar
        accessCode={quiz.access_code}
        isConnected={isConnected}
        qrOpen={showQr}
        onQrToggle={() => setShowQr((value) => !value)}
      />
      <ManagerQrPanel
        accessCode={quiz.access_code}
        isOpen={showQr}
        onClose={() => setShowQr(false)}
      />

      <main
        className={`mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-10 pt-24 transition-[padding] sm:px-6 ${
          showQr ? "sm:ps-84" : ""
        }`}
      >
        <section className="my-auto rounded-3xl border border-white/10 bg-[color:var(--live-surface)] p-5 shadow-2xl backdrop-blur-md sm:p-8">
          <div className="text-center">
            <p className="text-sm text-[color:var(--live-muted)]">
              {Number(participantCount).toLocaleString("fa-IR")} بازیکن آماده
            </p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">
              اتاق انتظار ارائه
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--live-muted)] sm:text-base">
              شرکت‌کنندگان از لینک یا QR وارد می‌شوند. فهرست زیر مستقیماً از
              roster محدودشدهٔ جلسه خوانده می‌شود.
            </p>
          </div>

          <div className="mt-8 min-h-64">
            {users.length === 0 ? (
              <div
                className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-white/15 bg-white/5 text-center text-[color:var(--live-muted)]"
                role="status"
              >
                در انتظار ورود شرکت‌کنندگان…
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {users.map((user) => {
                  const hidden = hiddenUserIds.has(user.user_id);
                  const color = getColorForUser(user.user_id);

                  return (
                    <li key={user.user_id}>
                      <button
                        type="button"
                        onClick={() => toggleName(user.user_id)}
                        className="flex min-h-24 w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 text-center transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        aria-pressed={hidden}
                        aria-label={
                          hidden
                            ? `نمایش نام ${user.name}`
                            : `پنهان کردن نام ${user.name}`
                        }
                      >
                        <span className="text-3xl" aria-hidden="true">
                          {user.character || "🙂"}
                        </span>
                        <span
                          className="mt-2 max-w-full truncate font-black"
                          style={{ color }}
                          dir="auto"
                        >
                          {hidden ? "••••" : user.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {hasMoreRoster ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMoreRoster()}
                  disabled={isRosterLoading}
                  className="min-h-11 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-bold hover:bg-white/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  {isRosterLoading ? "در حال بارگذاری…" : "نمایش شرکت‌کنندگان بیشتر"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={!isConnected}
              className="min-h-14 min-w-44 rounded-2xl bg-brand px-7 text-lg font-black text-content-inverse shadow-xl hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              {sessionInProgress ? "ادامه جلسه" : "شروع ارائه"}
            </button>
            {startError ? <Notice tone="error">{startError}</Notice> : null}
            {connectionError ? (
              <Notice tone="warning">
                اتصال زنده برقرار نیست؛ شروع ارائه تا بازیابی اتصال غیرفعال است.
              </Notice>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
