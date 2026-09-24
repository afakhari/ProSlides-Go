import type { LivePresentationModel } from "../../model/presentation.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";

type PlayerSyncStateProps = {
  quiz: LivePresentationModel;
  title: string;
  message: string;
};

export function PlayerSyncState({
  quiz,
  title,
  message,
}: PlayerSyncStateProps) {
  const { isConnected, connectionError } = useLiveSession();

  return (
    <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
      <section className="flex flex-1 items-center justify-center py-5 text-center">
        <div
          className="w-full rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-7 shadow-2xl backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white motion-reduce:animate-none"
            aria-hidden="true"
          />
          <h1 className="mt-5 text-2xl font-black">{title}</h1>
          <p className="mt-2 text-sm leading-7 text-[color:var(--live-muted)]">
            {message}
          </p>
          {connectionError ? (
            <p role="alert" className="mt-4 text-sm text-warning-soft">
              اتصال پایدار نیست؛ بازیابی جلسه به‌صورت خودکار ادامه دارد.
            </p>
          ) : null}
        </div>
      </section>
    </ParticipantShell>
  );
}
