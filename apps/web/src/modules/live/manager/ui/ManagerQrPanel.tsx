import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type ManagerQrPanelProps = {
  accessCode: string;
  isOpen: boolean;
  onClose: () => void;
};

export function ManagerQrPanel({
  accessCode,
  isOpen,
  onClose,
}: ManagerQrPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const joinUrl = useMemo(() => {
    const origin =
      typeof window === "undefined"
        ? "https://proslides.ir"
        : window.location.origin;
    return `${origin}/${accessCode}`;
  }, [accessCode]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    void QRCode.toDataURL(joinUrl, {
      margin: 2,
      width: 280,
      errorCorrectionLevel: "M",
    }).then((value) => {
      if (active) setQrDataUrl(value);
    });

    return () => {
      active = false;
    };
  }, [isOpen, joinUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/45 sm:hidden"
        onClick={onClose}
        aria-label="بستن پنل کد ورود"
      />
      <aside
        id="manager-live-qr-panel"
        dir="rtl"
        aria-label="کد ورود شرکت‌کنندگان"
        className="fixed inset-y-14 start-0 z-40 flex w-full max-w-sm flex-col items-center justify-center gap-5 border-e border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl backdrop-blur-xl sm:w-80"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 grid min-h-11 min-w-11 place-items-center rounded-full bg-white/10 text-2xl hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="بستن کد QR"
        >
          ×
        </button>

        <div className="text-center">
          <p className="text-sm text-white/65">ورود شرکت‌کنندگان</p>
          <h2 className="mt-1 text-2xl font-black">اسکن کنید و وارد شوید</h2>
        </div>

        <div className="grid min-h-72 min-w-72 place-items-center rounded-3xl bg-white p-4 shadow-xl">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="کد QR ورود به ارائه"
              className="h-64 w-64"
            />
          ) : (
            <span className="text-sm text-slate-500" role="status">
              در حال ساخت کد QR…
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void copyJoinUrl()}
          className="max-w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-center hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          dir="ltr"
          title="کپی لینک ورود"
        >
          <span className="block truncate text-sm font-bold">
            {joinUrl.replace(/^https?:\/\//, "")}
          </span>
        </button>
        <span className="min-h-5 text-xs text-success-soft" role="status" aria-live="polite">
          {copied ? "لینک ورود کپی شد." : ""}
        </span>
      </aside>
    </>
  );
}
