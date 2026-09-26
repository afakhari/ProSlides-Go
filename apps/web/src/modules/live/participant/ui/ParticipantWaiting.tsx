import type { LivePresentationModel } from "../../model/presentation.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";

export function ParticipantWaiting({
  quiz,
  message = "در حال همگام‌سازی جلسه…",
}: {
  quiz: LivePresentationModel;
  message?: string;
}) {
  const { isStreamConnected } = useLiveSession();

  return (
    <ParticipantShell quiz={quiz} connected={isStreamConnected} showConnection>
      <section className="flex flex-1 items-center justify-center py-8 text-center">
        <div className="w-full rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] px-6 py-10 shadow-2xl backdrop-blur-xl">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white motion-reduce:animate-none"
            aria-hidden="true"
          />
          <p className="mt-5 text-lg font-black" role="status" aria-live="polite">
            {message}
          </p>
          <p className="mt-2 text-sm leading-7 text-[color:var(--live-muted)]">
            نیازی به تازه‌سازی صفحه نیست.
          </p>
        </div>
      </section>
    </ParticipantShell>
  );
}
