import type { ReactNode } from "react";

export type NoticeTone = "info" | "success" | "warning" | "error";

type NoticeProps = {
  children: ReactNode;
  tone?: NoticeTone;
  pending?: boolean;
  action?: ReactNode;
  className?: string;
  id?: string;
};

const toneClasses: Record<NoticeTone, string> = {
  info: "border-info-border bg-info-soft text-info-ink",
  success: "border-success-border bg-success-soft text-success-ink",
  warning: "border-warning-border bg-warning-soft text-warning-ink",
  error: "border-danger-border bg-danger-soft text-danger-ink",
};

export default function Notice({
  children,
  tone = "info",
  pending = false,
  action,
  className = "",
  id,
}: NoticeProps) {
  const isError = tone === "error";

  return (
    <div
      id={id}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      aria-busy={pending || undefined}
      className={`flex items-center justify-between gap-3 rounded-panel border px-4 py-3 text-sm font-medium shadow-sm ${toneClasses[tone]} ${className}`}
    >
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  );
}
