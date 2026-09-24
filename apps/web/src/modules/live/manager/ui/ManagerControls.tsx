import { useState } from "react";

import { ConfirmDialog } from "../../../shared/ui/primitives/ConfirmDialog.tsx";

type ManagerControlsProps = {
  currentSlide: number;
  totalSlides: number;
  onNext?: () => void | Promise<void>;
  onEnd: () => void | Promise<void>;
  onShowLeaderboard?: () => void;
  endOnLastSlide?: boolean;
};

export function ManagerControls({
  currentSlide,
  totalSlides,
  onNext,
  onEnd,
  onShowLeaderboard,
  endOnLastSlide = true,
}: ManagerControlsProps) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  const safeTotal = Math.max(totalSlides, 1);
  const safeCurrent = Math.min(Math.max(currentSlide, 1), safeTotal);
  const atEnd = endOnLastSlide && safeCurrent >= safeTotal;
  const progress = (safeCurrent / safeTotal) * 100;

  const handlePrimary = () => {
    if (atEnd) {
      setConfirmEnd(true);
      return;
    }
    void onNext?.();
  };

  const confirmPresentationEnd = async () => {
    setEnding(true);
    try {
      await onEnd();
      setConfirmEnd(false);
    } finally {
      setEnding(false);
    }
  };

  return (
    <>
      <footer
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-30 flex min-h-16 items-center justify-between gap-3 border-t border-white/10 bg-black/25 px-3 py-2 text-[color:var(--live-fg)] backdrop-blur-md sm:px-5"
        aria-label="کنترل ارائه"
      >
        <div className="min-w-28">
          <p className="text-xs text-[color:var(--live-muted)]">اسلاید</p>
          <p className="font-bold" dir="ltr">
            {safeCurrent.toLocaleString("fa-IR")} / {safeTotal.toLocaleString("fa-IR")}
          </p>
          <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-success transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onShowLeaderboard ? (
            <button
              type="button"
              onClick={onShowLeaderboard}
              className="min-h-11 rounded-xl bg-white/10 px-3 text-sm font-bold hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              جدول امتیازات
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setConfirmEnd(true)}
            className="min-h-11 rounded-xl bg-danger/85 px-3 text-sm font-bold text-white hover:bg-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            پایان ارائه
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={!atEnd && !onNext}
            className="min-h-11 rounded-xl bg-brand px-5 text-sm font-black text-content-inverse hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {atEnd ? "پایان" : "بعدی"}
          </button>
        </div>
      </footer>

      <ConfirmDialog
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={confirmPresentationEnd}
        title="پایان ارائه؟"
        description="جلسه برای شرکت‌کنندگان پایان می‌یابد و نمایش نتیجه نهایی فعال می‌شود."
        confirmText="پایان ارائه"
        cancelText="ادامه ارائه"
        confirmVariant="destructive"
        isLoading={ending}
      />
    </>
  );
}
