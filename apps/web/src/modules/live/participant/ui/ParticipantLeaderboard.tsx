import type { LivePresentationModel } from "../../model/presentation.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";

type ParticipantLeaderboardProps = {
  quiz: LivePresentationModel;
};

export function ParticipantLeaderboard({
  quiz,
}: ParticipantLeaderboardProps) {
  const { participantCount, snapshot, isConnected } = useLiveSession();
  const participant =
    snapshot?.role === "participant" ? snapshot.participant : null;
  const rank = participant?.rank;
  const score = Number(participant?.score ?? 0);

  return (
    <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
      <section className="flex flex-1 flex-col justify-center py-5 text-center">
        <div className="rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-6 shadow-2xl backdrop-blur-xl sm:p-10">
          <p className="text-sm font-bold text-[color:var(--live-muted)]">
            رتبه‌بندی کلی
          </p>
          <h1 className="mt-2 text-3xl font-black">جایگاه فعلی شما</h1>

          <div className="mx-auto my-7 grid h-36 w-36 place-items-center rounded-full border-4 border-white/25 bg-white/10 shadow-2xl">
            <div>
              <p className="text-sm text-[color:var(--live-muted)]">رتبه</p>
              <p className="text-5xl font-black">
                {rank == null ? "—" : Number(rank).toLocaleString("fa-IR")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[color:var(--live-border)] bg-white/10 p-4">
              <p className="text-xs text-[color:var(--live-muted)]">
                امتیاز شما
              </p>
              <p className="mt-1 text-2xl font-black">
                {score.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--live-border)] bg-white/10 p-4">
              <p className="text-xs text-[color:var(--live-muted)]">
                شرکت‌کنندگان
              </p>
              <p className="mt-1 text-2xl font-black">
                {Number(participantCount || 0).toLocaleString("fa-IR")}
              </p>
            </div>
          </div>

          <p className="mt-7 text-sm leading-7 text-[color:var(--live-muted)]">
            مرحلهٔ بعدی به‌صورت خودکار نمایش داده می‌شود. این صفحه را باز نگه
            دارید.
          </p>
        </div>
      </section>
    </ParticipantShell>
  );
}
