import { useState } from "react";

import { isContentSlide } from "../../model/presentationFlow.ts";
import type { LegacyContentSlide } from "../../model/serverData.ts";
import { participantTheme } from "../../participant/theme.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ManagerControls } from "./ManagerControls.tsx";
import { ManagerQrPanel } from "./ManagerQrPanel.tsx";
import { ManagerTopBar } from "./ManagerTopBar.tsx";
import type { ManagerStageProps } from "./types.ts";

type ManagerContentSlideProps = ManagerStageProps & {
  content: LegacyContentSlide | null;
};

export function ManagerContentSlide({
  quiz,
  content,
  currentSlide,
  totalSlides,
  onNext,
  onEndGame,
}: ManagerContentSlideProps) {
  const { isConnected, sendNavigation, sendEnd } = useLiveSession();
  const [showQr, setShowQr] = useState(false);

  const definition = quiz.slides[currentSlide - 1];
  const source =
    content ?? (isContentSlide(definition) ? definition : null);

  const handleNext = async () => {
    const nextSlide = quiz.slides[currentSlide];
    if (!nextSlide) {
      if (await sendEnd()) onEndGame();
      return;
    }

    if (!(await sendNavigation("next", { slide: nextSlide }))) return;
    onNext();
  };

  const handleEnd = async () => {
    if (await sendEnd()) onEndGame();
  };

  const theme = participantTheme(quiz);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-cover bg-center text-[color:var(--live-fg)]"
      style={theme.style}
    >
      <ManagerTopBar
        accessCode={quiz.access_code}
        isConnected={isConnected}
        qrOpen={showQr}
        onQrToggle={() => setShowQr((value) => !value)}
      />
      <ManagerQrPanel
        accessCode={quiz.access_code}
        isOpen={showQr}
        onClose={() => setShowQr(false)}
      />

      <main
        className={`flex min-h-screen items-center px-4 pb-24 pt-20 transition-[padding] sm:px-6 ${
          showQr ? "sm:ps-84" : ""
        }`}
      >
        <article className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-[color:var(--live-surface)] p-6 text-center shadow-2xl backdrop-blur sm:p-10">
          {!source ? (
            <p role="status" className="text-[color:var(--live-muted)]">
              در حال همگام‌سازی محتوای اسلاید…
            </p>
          ) : (
            <>
              {source.title ? (
                <h1 className="text-3xl font-black sm:text-5xl" dir="auto">
                  {source.title}
                </h1>
              ) : null}
              {source.content_text ? (
                <p
                  className="mx-auto mt-6 max-w-3xl whitespace-pre-wrap text-lg leading-9 text-[color:var(--live-muted)]"
                  dir="auto"
                >
                  {source.content_text}
                </p>
              ) : null}
              {source.content_image_url ? (
                <img
                  src={source.content_image_url}
                  alt={source.title || "تصویر اسلاید توضیحی"}
                  className="mx-auto mt-7 max-h-[52dvh] max-w-full rounded-2xl object-contain shadow-xl"
                />
              ) : null}
            </>
          )}
        </article>
      </main>

      <ManagerControls
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        onNext={handleNext}
        onEnd={handleEnd}
      />
    </div>
  );
}
