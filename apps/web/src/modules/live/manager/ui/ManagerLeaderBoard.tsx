import { useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";

import { getColorForUser } from "../../../../shared/lib/playerColor.ts";
import type { LegacyLiveUser } from "../../model/serverData.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { useServerData } from "../../react/useServerData.ts";
import { ManagerControls } from "./ManagerControls.tsx";
import { ManagerLeaderboardDialog } from "./ManagerLeaderboardDialog.tsx";
import { ManagerQrPanel } from "./ManagerQrPanel.tsx";
import { ManagerTopBar } from "./ManagerTopBar.tsx";
import type { ManagerStageProps } from "./types.ts";

type DisplayPlayer = LegacyLiveUser & {
  color: string;
};

export function ManagerLeaderBoard({
  currentSlide,
  totalSlides,
  quiz,
  onNext,
  onEndGame,
}: ManagerStageProps) {
  const {
    isConnected,
    sendNavigation,
    sendEnd,
    participantCount,
    hasMoreRoster,
    isRosterLoading,
    loadMoreRoster,
  } = useLiveSession();
  const {
    managerLastLeaderboard,
    leaderboardResults,
    modalLeaderboardResults,
  } = useServerData();
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [showQr, setShowQr] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const sourcePlayers = useMemo(
    () =>
      leaderboardResults && leaderboardResults.length > 0
        ? leaderboardResults
        : managerLastLeaderboard ?? [],
    [leaderboardResults, managerLastLeaderboard],
  );

  const players = useMemo<DisplayPlayer[]>(
    () =>
      sourcePlayers.map((player) => ({
        ...player,
        color: getColorForUser(player.user_id),
      })),
    [sourcePlayers],
  );

  const maxScore = useMemo(
    () =>
      players.length > 0
        ? Math.max(...players.map((player) => player.total_points || 0), 0)
        : 0,
    [players],
  );

  const toggleName = (userId: string) => {
    setHiddenUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleNext = async () => {
    const nextSlide = quiz.slides[currentSlide];
    if (!nextSlide) {
      if (await sendEnd()) onEndGame();
      return;
    }

    if (!(await sendNavigation("next", { slide: nextSlide }))) return;
    onNext();
  };

  const handleEnd = async () => {
    if (await sendEnd()) onEndGame();
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
        className={`min-h-screen px-4 pb-24 pt-24 transition-[padding] sm:px-6 ${
          showQr ? "sm:ps-84" : ""
        }`}
      >
        <section className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm text-[color:var(--live-muted)]">
              نتیجه مرحله
            </p>
            <h1 className="mt-2 text-4xl font-black sm:text-6xl">
              جدول امتیازات
            </h1>
            <p className="mt-3 text-[color:var(--live-muted)]">
              {Number(participantCount).toLocaleString("fa-IR")} شرکت‌کننده
            </p>
          </div>

          <div className="mt-8 max-h-[62dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur sm:p-6">
            {players.length === 0 ? (
              <div
                className="grid min-h-52 place-items-center text-center text-[color:var(--live-muted)]"
                role="status"
              >
                در حال دریافت جدول امتیازات…
              </div>
            ) : (
              <ol className="space-y-3">
                <AnimatePresence initial={false}>
                  {players.map((player, index) => {
                    const hidden = hiddenUserIds.has(player.user_id);
                    const score = Math.max(0, Number(player.total_points || 0));
                    const width =
                      maxScore > 0
                        ? Math.max(4, (score / maxScore) * 100)
                        : 0;

                    return (
                      <Motion.li
                        layout
                        key={player.user_id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3"
                      >
                        <span
                          className="grid h-10 w-10 place-items-center rounded-full font-black text-white"
                          style={{ backgroundColor: player.color }}
                        >
                          {(player.rank ?? index + 1).toLocaleString("fa-IR")}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleName(player.user_id)}
                          className="relative min-h-14 overflow-hidden rounded-xl bg-white/10 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                          aria-pressed={hidden}
                          aria-label={
                            hidden
                              ? `نمایش نام ${player.name}`
                              : `پنهان کردن نام ${player.name}`
                          }
                        >
                          {width > 0 ? (
                            <Motion.span
                              className="absolute inset-y-0 start-0 rounded-xl opacity-70"
                              style={{ backgroundColor: player.color }}
                              initial={{ width: 0 }}
                              animate={{ width: `${width}%` }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                            />
                          ) : null}
                          <span className="relative z-10 flex min-h-14 items-center gap-3 px-4">
                            <span className="text-2xl" aria-hidden="true">
                              {player.character || "🙂"}
                            </span>
                            <span className="truncate font-bold" dir="auto">
                              {hidden ? "••••" : player.name}
                            </span>
                          </span>
                        </button>

                        <span className="min-w-24 text-end text-sm font-black sm:text-base">
                          {Math.round(score).toLocaleString("fa-IR")} امتیاز
                          {player.new_points != null &&
                          Number.isFinite(player.new_points) &&
                          player.new_points !== 0 ? (
                            <small className="mt-1 block text-xs text-[color:var(--live-muted)]">
                              +{Math.round(Number(player.new_points)).toLocaleString("fa-IR")}
                            </small>
                          ) : null}
                        </span>
                      </Motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>
            )}

          </div>
        </section>
      </main>

      <ManagerControls
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        onNext={handleNext}
        onEnd={handleEnd}
        onShowLeaderboard={() => setShowLeaderboard(true)}
      />

      <ManagerLeaderboardDialog
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        players={modalLeaderboardResults ?? sourcePlayers}
        hasMore={hasMoreRoster}
        isLoading={isRosterLoading}
        onLoadMore={() => void loadMoreRoster()}
      />
    </div>
  );
}
