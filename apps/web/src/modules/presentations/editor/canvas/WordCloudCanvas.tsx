import { useMemo } from "react";
import { Cloud, Clock3, MessageCircleMore } from "lucide-react";

import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import { presentationTheme } from "../../../../shared/styles/presentationTheme.ts";
import type { EditorSlide } from "../../model/editor.ts";
import { createWordCloudDraft } from "../model/wordCloudDraft.ts";
import { useOptionalDesignDraft } from "../model/useDesignDraftContext.ts";
import { useOptionalWordCloudDraft } from "../model/useWordCloudDraftContext.ts";

type WordCloudCanvasProps = {
  slide: EditorSlide;
  quizBackground?: string;
  quizBackgroundImage?: string;
  textColor?: string;
};

const previewTerms = [
  ["خلاقیت", "text-4xl"],
  ["یادگیری", "text-3xl"],
  ["تعامل", "text-2xl"],
  ["ایده", "text-xl"],
  ["همکاری", "text-lg"],
] as const;

export default function WordCloudCanvas({
  slide,
  quizBackground,
  quizBackgroundImage,
  textColor = "#111827",
}: WordCloudCanvasProps) {
  const designController = useOptionalDesignDraft();
  const controller = useOptionalWordCloudDraft();
  const persistedDraft = useMemo(() => createWordCloudDraft(slide), [slide]);
  const draft =
    controller?.draft?.slideId === slide.slide_id
      ? controller.draft
      : persistedDraft;

  const theme = useMemo(
    () =>
      presentationTheme({
        background: {
          color: designController?.draft.backgroundColor ?? quizBackground,
          image:
            designController?.draft.backgroundImageUrl ?? quizBackgroundImage,
          text_color: designController?.draft.textColor ?? textColor,
        },
        text_color: designController?.draft.textColor ?? textColor,
      }),
    [
      designController?.draft.backgroundColor,
      designController?.draft.backgroundImageUrl,
      designController?.draft.textColor,
      quizBackground,
      quizBackgroundImage,
      textColor,
    ],
  );

  if (!draft) return null;

  return (
    <section
      aria-label="پیش‌نمایش ابر واژه"
      className="relative flex h-full max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-[color:var(--live-border)] bg-cover bg-center text-[color:var(--live-fg)] shadow-2xl"
      style={theme.style}
    >
      <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--live-border)] bg-black/25 px-3 py-1.5 backdrop-blur-md">
            <Cloud className="size-3.5" aria-hidden="true" />
            ابر واژه
          </span>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5">
              <MessageCircleMore className="size-3.5" aria-hidden="true" />
              تا {formatPersianNumber(draft.maxWords)} واژه
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1.5">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {formatPersianNumber(draft.durationSeconds)} ثانیه
            </span>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="text-sm font-bold text-[color:var(--live-muted)]">
            پیش‌نمایش نتیجه زنده
          </p>
          <h2
            dir="auto"
            className="mt-2 whitespace-pre-wrap text-3xl font-black leading-[1.5] sm:text-4xl"
          >
            {draft.prompt || "پرسش ابر واژه اینجا نمایش داده می‌شود"}
          </h2>

          <div
            className="mt-8 flex min-h-48 w-full flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-3xl border border-[color:var(--live-border)] bg-black/15 p-6"
            aria-label="نمونه چیدمان ابر واژه"
          >
            {previewTerms.map(([term, size]) => (
              <span
                key={term}
                className={size + " font-black leading-none"}
                dir="auto"
              >
                {term}
              </span>
            ))}
          </div>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-[color:var(--live-muted)]">
            اندازه هر واژه با فراوانی پاسخ‌ها بیشتر می‌شود. تکرار یک واژه در
            پاسخ یک شرکت‌کننده فقط یک بار شمرده می‌شود.
          </p>
        </div>

        {(controller?.dirty || designController?.dirty) && (
          <footer className="border-t border-[color:var(--live-border)] pt-3 text-xs font-bold text-warning-ink">
            تغییرات ذخیره‌نشده در پیش‌نمایش نمایش داده می‌شوند.
          </footer>
        )}
      </div>
    </section>
  );
}
