import type { ReactNode } from "react";
import { participantTheme, type ParticipantQuizTheme } from "./theme";

interface ParticipantShellProps {
  quiz?: ParticipantQuizTheme;
  children: ReactNode;
  connected?: boolean;
  showConnection?: boolean;
  className?: string;
}

export function ParticipantShell({
  quiz,
  children,
  connected = true,
  showConnection = false,
  className = "",
}: ParticipantShellProps) {
  const theme = participantTheme(quiz);
  return (
    <div
      dir="rtl"
      className={`participant-live-shell min-h-[100dvh] w-full overflow-x-hidden bg-cover bg-center text-[color:var(--live-fg)] ${className}`}
      style={theme.style}
    >
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="min-w-0">
          <p className="font-outfit text-lg font-extrabold tracking-tight" dir="ltr">ProSlides</p>
          {quiz?.title && <p className="truncate text-xs text-[color:var(--live-muted)]" dir="auto">{quiz.title}</p>}
        </div>
        {showConnection && (
          <div className="flex items-center gap-2 rounded-full border border-[color:var(--live-border)] bg-black/20 px-3 py-1.5 text-xs backdrop-blur-md" role="status" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-300"}`} />
            {connected ? "متصل" : "در حال اتصال"}
          </div>
        )}
      </header>
      <main className="mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-3xl flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        {children}
      </main>
    </div>
  );
}
