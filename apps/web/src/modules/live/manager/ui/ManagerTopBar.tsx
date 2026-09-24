import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAudio } from "../../react/AudioProvider.tsx";

type ManagerTopBarProps = {
  accessCode: string;
  isConnected: boolean;
  qrOpen: boolean;
  onQrToggle: () => void;
};

export function ManagerTopBar({
  accessCode,
  isConnected,
  qrOpen,
  onQrToggle,
}: ManagerTopBarProps) {
  const navigate = useNavigate();
  const { isMuted, toggleMute } = useAudio();
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    const origin =
      typeof window === "undefined"
        ? "https://proslides.ir"
        : window.location.origin;
    return `${origin}/${accessCode}`;
  }, [accessCode]);

  const displayUrl = joinUrl.replace(/^https?:\/\//, "");

  const copyJoinUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <header
      dir="rtl"
      className="fixed inset-x-0 top-0 z-50 flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-3 py-2 text-[color:var(--live-fg)] backdrop-blur-md sm:px-5"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate("/manager/panel")}
          className="grid min-h-11 min-w-11 place-items-center rounded-full bg-black/20 text-lg transition hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="بازگشت به پنل مدیریت"
        >
          ←
        </button>
        <button
          type="button"
          onClick={toggleMute}
          className="grid min-h-11 min-w-11 place-items-center rounded-full bg-black/20 text-lg transition hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label={isMuted ? "روشن کردن صدا" : "بی‌صدا کردن"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className="min-w-0 flex-1 text-center">
        <p className="text-xs text-[color:var(--live-muted)] sm:text-sm">
          برای ورود
        </p>
        <button
          type="button"
          onClick={() => void copyJoinUrl()}
          className="max-w-full truncate rounded-lg px-2 py-1 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:text-base"
          dir="ltr"
          title="کپی لینک ورود"
        >
          {displayUrl}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? "لینک ورود کپی شد" : ""}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="hidden items-center gap-2 rounded-full bg-black/20 px-3 py-2 text-xs sm:flex"
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isConnected ? "bg-success" : "bg-warning"
            }`}
            aria-hidden="true"
          />
          {isConnected ? "متصل" : "در حال اتصال"}
        </div>
        <button
          type="button"
          onClick={onQrToggle}
          className="min-h-11 rounded-xl bg-white/90 px-3 text-sm font-bold text-slate-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-expanded={qrOpen}
          aria-controls="manager-live-qr-panel"
        >
          {qrOpen ? "بستن QR" : "نمایش QR"}
        </button>
      </div>
    </header>
  );
}
