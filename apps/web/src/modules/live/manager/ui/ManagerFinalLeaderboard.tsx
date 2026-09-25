import { useMemo } from "react";
import { motion as Motion } from "framer-motion";

import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyLiveUser } from "../../model/serverData.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";

type ManagerFinalLeaderboardProps = {
  leaderboardData: LegacyLiveUser[];
  quiz: LivePresentationModel;
  onExit: () => void;
};

const PODIUM = [
  {
    order: "md:order-2",
    height: "h-56 md:h-72",
    gradient: "from-amber-300 to-yellow-500",
    icon: "👑",
  },
  {
    order: "md:order-1",
    height: "h-44 md:h-56",
    gradient: "from-slate-200 to-slate-400",
    icon: "🥈",
  },
  {
    order: "md:order-3",
    height: "h-36 md:h-44",
    gradient: "from-orange-300 to-amber-600",
    icon: "🥉",
  },
] as const;

export function ManagerFinalLeaderboard({
  leaderboardData,
  quiz,
  onExit,
}: ManagerFinalLeaderboardProps) {
  const { isConnected, snapshot } = useLiveSession();
  const hasScoring =
    snapshot?.role === "manager" ? snapshot.has_scoring : false;
  const players = useMemo(
    () =>
      [...leaderboardData]
        .sort(
          (left, right) =>
            Number(right.total_points || 0) - Number(left.total_points || 0),
        )
        .slice(0, 3),
    [leaderboardData],
  );
  const theme = participantTheme(quiz);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex flex-col overflow-auto bg-cover bg-center px-4 py-6 text-[color:var(--live-fg)]"
      style={theme.style}
    >
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <p className="font-outfit text-xl font-black" dir="ltr">
          ProSlides
        </p>
        <div
          className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs backdrop-blur"
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? "bg-success" : "bg-warning"
            }`}
            aria-hidden="true"
          />
          {isConnected ? "متصل" : "در حال اتصال"}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center py-7 text-center">
        <Motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm font-bold text-white/70"
        >
          پایان کوئیز
        </Motion.p>
        <Motion.h1
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 text-4xl font-black md:text-6xl"
        >
          برترین‌های این رقابت
        </Motion.h1>

        {!hasScoring ? (
          <div className="mt-10 max-w-xl rounded-3xl border border-white/15 bg-black/20 px-8 py-10 text-white/75 backdrop-blur">
            <h2 className="text-2xl font-black text-white">جلسه پایان یافت</h2>
            <p className="mt-3 leading-7">
              این جلسه فعالیت امتیازی نداشت؛ بنابراین رتبه‌بندی نهایی یا سکو نمایش داده نمی‌شود.
            </p>
          </div>
        ) : players.length > 0 ? (
          <div className="mt-10 flex w-full flex-col items-stretch justify-center gap-4 md:flex-row md:items-end">
            {players.map((player, index) => {
              const style = PODIUM[index];
              const rank = index + 1;

              return (
                <Motion.article
                  key={player.user_id}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: rank * 0.18 }}
                  className={`flex flex-1 flex-col items-center ${style.order}`}
                >
                  <div className="relative z-10 -mb-6 grid h-24 w-24 place-items-center rounded-full border-4 border-white/70 bg-slate-900 text-5xl shadow-2xl">
                    <span className="absolute -top-7 text-4xl" aria-hidden="true">
                      {style.icon}
                    </span>
                    <span aria-hidden="true">{player.character || "👤"}</span>
                  </div>
                  <div
                    className={`flex w-full max-w-xs flex-col justify-between rounded-t-3xl bg-gradient-to-b ${style.gradient} ${style.height} px-4 pb-5 pt-10 text-slate-950 shadow-2xl`}
                  >
                    <div>
                      <h2 className="truncate text-xl font-black" dir="auto">
                        {player.name}
                      </h2>
                      <p className="mt-1 font-bold">
                        {Math.round(player.total_points || 0).toLocaleString("fa-IR")} امتیاز
                      </p>
                    </div>
                    <p className="text-5xl font-black opacity-30">
                      {rank.toLocaleString("fa-IR")}
                    </p>
                  </div>
                </Motion.article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-white/15 bg-black/20 px-8 py-10 text-white/75 backdrop-blur">
            هنوز امتیازی برای نمایش وجود ندارد.
          </div>
        )}

        <button
          type="button"
          onClick={onExit}
          className="mt-9 min-h-12 rounded-2xl bg-white px-7 font-black text-slate-950 shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
        >
          بازگشت به پنل مدیریت
        </button>
      </main>
    </div>
  );
}
