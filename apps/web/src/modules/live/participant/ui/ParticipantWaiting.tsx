import type { LivePresentationModel } from "../../model/presentation.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";

export function ParticipantWaiting({
  quiz,
  message = "منتظر مرحله بعدی هستیم",
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
            className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[color:var(--live-border)] bg-white/10"
            aria-hidden="true"
          >
            <span className="h-3 w-3 animate-pulse rounded-full bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.08)] motion-reduce:animate-none" />
          </div>
          <p
            className="mt-5 text-xl font-black"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {message}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[color:var(--live-muted)]">
            مرحله بعدی خودکار نمایش داده می‌شود. صفحه را باز نگه دارید؛ اگر ارتباط قطع شود، تلاش برای بازیابی ادامه پیدا می‌کند.
          </p>
        </div>
      </section>
    </ParticipantShell>
  );
}
