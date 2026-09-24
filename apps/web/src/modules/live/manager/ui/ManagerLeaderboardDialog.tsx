import { useEffect, useMemo, useRef } from "react";

import type { LegacyLiveUser } from "../../model/serverData.ts";
import { getColorForUser } from "../../../../shared/lib/playerColor.ts";

type ManagerLeaderboardDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  players: LegacyLiveUser[];
};

export function ManagerLeaderboardDialog({
  isOpen,
  onClose,
  players,
}: ManagerLeaderboardDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const maxScore = useMemo(
    () =>
      players.length > 0
        ? Math.max(...players.map((player) => player.total_points || 0), 0)
        : 0,
    [players],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      className="m-auto w-[min(54rem,calc(100vw-2rem))] max-h-[80dvh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-950 p-0 text-white shadow-2xl backdrop:bg-black/65"
      aria-labelledby="manager-leaderboard-dialog-title"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/95 px-5 py-4 backdrop-blur">
        <div>
          <h2 id="manager-leaderboard-dialog-title" className="text-2xl font-black">
            جدول امتیازات
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {players.length.toLocaleString("fa-IR")} شرکت‌کننده
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid min-h-11 min-w-11 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="بستن جدول امتیازات"
        >
          ×
        </button>
      </div>

      <ol className="space-y-3 p-5">
        {players.length === 0 ? (
          <li className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/65">
            هنوز امتیازی برای نمایش وجود ندارد.
          </li>
        ) : (
          players.map((player, index) => {
            const score = Math.max(0, Number(player.total_points || 0));
            const color = getColorForUser(player.user_id);
            const width =
              maxScore > 0 ? Math.max(10, (score / maxScore) * 100) : 0;

            return (
              <li
                key={player.user_id}
                className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3"
              >
                <span
                  className="grid h-10 w-10 place-items-center rounded-full font-black text-white"
                  style={{ backgroundColor: color }}
                >
                  {(player.rank ?? index + 1).toLocaleString("fa-IR")}
                </span>
                <div className="relative min-h-14 overflow-hidden rounded-xl bg-white/10">
                  {width > 0 ? (
                    <div
                      className="absolute inset-y-0 start-0 rounded-xl opacity-80"
                      style={{ width: `${width}%`, backgroundColor: color }}
                    />
                  ) : null}
                  <div className="relative z-10 flex min-h-14 items-center gap-3 px-4">
                    <span className="text-2xl" aria-hidden="true">
                      {player.character || "🙂"}
                    </span>
                    <span className="truncate font-bold" dir="auto">
                      {player.name}
                    </span>
                  </div>
                </div>
                <span className="whitespace-nowrap text-sm font-black">
                  {Math.round(score).toLocaleString("fa-IR")} امتیاز
                </span>
              </li>
            );
          })
        )}
      </ol>
    </dialog>
  );
}
