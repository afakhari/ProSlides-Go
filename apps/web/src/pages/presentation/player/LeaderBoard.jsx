import { motion as Motion } from "framer-motion";
import { useLiveSession } from "../../../hooks/useLiveSession";
import { ParticipantShell } from "../../../modules/live/participant/ParticipantShell";

export default function PlayerLeaderBoard({ quiz }) {
  const { participantCount, snapshot, isConnected } = useLiveSession();
  const participant = snapshot?.role === "participant" ? snapshot.participant : null;
  const rank = participant?.rank;
  const score = Number(participant?.score || 0);

  return (
    <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
      <section className="flex flex-1 flex-col justify-center py-5 text-center">
        <Motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-6 shadow-2xl backdrop-blur-xl sm:p-10">
          <p className="text-sm font-bold text-[color:var(--live-muted)]">نتیجه‌ی این مرحله</p>
          <h1 className="mt-2 text-3xl font-black">جایگاه شما</h1>
          <div className="mx-auto my-7 grid h-36 w-36 place-items-center rounded-full border-4 border-white/25 bg-white/10 shadow-2xl">
            <div><p className="text-sm text-[color:var(--live-muted)]">رتبه</p><p className="text-5xl font-black" dir="ltr">{rank ?? "—"}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[color:var(--live-border)] bg-white/10 p-4"><p className="text-xs text-[color:var(--live-muted)]">امتیاز شما</p><p className="mt-1 text-2xl font-black" dir="ltr">{score.toLocaleString("fa-IR")}</p></div>
            <div className="rounded-2xl border border-[color:var(--live-border)] bg-white/10 p-4"><p className="text-xs text-[color:var(--live-muted)]">شرکت‌کنندگان</p><p className="mt-1 text-2xl font-black" dir="ltr">{Number(participantCount || 0).toLocaleString("fa-IR")}</p></div>
          </div>
          <p className="mt-7 text-sm leading-7 text-[color:var(--live-muted)]">مرحله‌ی بعدی به‌زودی شروع می‌شود؛ همین صفحه را باز نگه دارید.</p>
        </Motion.div>
      </section>
    </ParticipantShell>
  );
}
