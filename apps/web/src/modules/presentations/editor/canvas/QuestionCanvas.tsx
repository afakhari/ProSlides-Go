import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Gauge,
  ImageOff,
  ListChecks,
  Trophy,
  Zap,
} from "lucide-react";

import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import { presentationTheme } from "../../../../shared/styles/presentationTheme.ts";
import { useOptionalDesignDraft } from "../model/useDesignDraftContext.ts";
import { createQuestionDraft } from "../model/questionDraft.ts";
import { createQuestionPreviewModel } from "../model/questionPreview.ts";
import { useOptionalQuestionDraft } from "../model/useQuestionDraftContext.ts";
import type { EditorSlide } from "../../model/editor.ts";

type QuestionCanvasProps = {
  slide: EditorSlide;
  quizBackground?: string;
  quizBackgroundImage?: string;
  textColor?: string;
  isFullSize?: boolean;
};

function PreviewImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        className={`${className} grid place-items-center border border-[color:var(--live-border)] bg-black/20 text-[color:var(--live-muted)]`}
        role="img"
        aria-label="تصویر قابل نمایش نیست"
      >
        <span className="flex flex-col items-center gap-2 px-3 text-center text-xs">
          <ImageOff className="size-5" aria-hidden="true" />
          تصویر بارگذاری نشد
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

export default function QuestionCanvas({
  slide,
  quizBackground,
  quizBackgroundImage,
  textColor = "#111827",
  isFullSize = true,
}: QuestionCanvasProps) {
  const designController = useOptionalDesignDraft();
  const controller = useOptionalQuestionDraft();
  const persistedDraft = useMemo(
    () => createQuestionDraft(slide),
    [slide],
  );
  const draft =
    controller?.draft?.slideId === slide.slide_id
      ? controller.draft
      : persistedDraft;

  const preview = useMemo(
    () => (draft ? createQuestionPreviewModel(draft) : null),
    [draft],
  );

  const theme = useMemo(
    () =>
      presentationTheme({
        background: {
          color: designController?.draft.backgroundColor ?? quizBackground,
          image: designController?.draft.backgroundImageUrl ?? quizBackgroundImage,
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

  if (!draft || !preview) return null;

  const denseOptions = preview.options.length > 6;
  const shellPadding = isFullSize ? "p-5 sm:p-7" : "p-4";
  const titleSize = isFullSize
    ? "text-2xl sm:text-3xl lg:text-4xl"
    : "text-xl sm:text-2xl";

  return (
    <section
      aria-label="پیش‌نمایش سؤال"
      className="relative flex h-full max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-[color:var(--live-border)] bg-cover bg-center text-[color:var(--live-fg)] shadow-2xl"
      style={theme.style}
    >
      <div
        className={`flex min-h-0 flex-1 flex-col ${shellPadding}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full border border-[color:var(--live-border)] bg-black/25 px-3 py-1.5 backdrop-blur-md">
              پیش‌نمایش شرکت‌کننده
            </span>
            {controller?.dirty && (
              <span className="rounded-full border border-warning-border bg-warning-soft px-3 py-1.5 text-warning-ink">
                تغییرات ذخیره‌نشده
              </span>
            )}
            {designController?.dirty && (
              <span className="rounded-full border border-warning-border bg-warning-soft px-3 py-1.5 text-warning-ink">
                طراحی ذخیره‌نشده
              </span>
            )}
            {preview.validationIssueCount > 0 && (
              <span className="rounded-full border border-danger-border bg-danger-soft px-3 py-1.5 text-danger-ink">
                نیازمند تکمیل
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--live-border)] bg-black/25 px-3 py-1.5">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {preview.durationLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--live-border)] bg-black/25 px-3 py-1.5">
              <Gauge className="size-3.5" aria-hidden="true" />
              {preview.pointsLabel}
            </span>
          </div>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col">
          <div className="mx-auto w-full max-w-4xl text-center">
            <p className="text-xs font-bold text-[color:var(--live-muted)]">
              {preview.typeLabel} · {preview.interactionLabel}
            </p>
            <h2
              className={`mt-2 whitespace-pre-wrap font-black leading-[1.5] ${titleSize}`}
              dir="auto"
            >
              {preview.questionText || "متن سؤال اینجا نمایش داده می‌شود"}
            </h2>
          </div>

          {preview.questionImageUrl && (
            <PreviewImage
              src={preview.questionImageUrl}
              alt="تصویر سؤال"
              className="mx-auto mt-4 max-h-48 w-auto max-w-full rounded-2xl border border-[color:var(--live-border)] bg-black/10 object-contain shadow-lg"
            />
          )}

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pe-1">
            <div
              className={`grid gap-3 ${
                denseOptions
                  ? "sm:grid-cols-2 xl:grid-cols-3"
                  : "sm:grid-cols-2"
              }`}
            >
              {preview.options.map((option) => (
                <article
                  key={option.id}
                  aria-label={`گزینه ${formatPersianNumber(option.position)}: ${option.text || `گزینه ${formatPersianNumber(option.position)}`}${option.isCorrect ? "، پاسخ صحیح" : ""}`}
                  className={`relative flex min-h-16 items-center gap-3 rounded-2xl border-2 p-3 text-start backdrop-blur-md ${
                    option.isCorrect
                      ? "border-emerald-300/80 bg-emerald-950/35"
                      : "border-[color:var(--live-border)] bg-white/10"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center border-2 text-xs font-black ${
                      draft.type === "single" ? "rounded-full" : "rounded-md"
                    } ${
                      option.isCorrect
                        ? "border-emerald-200 bg-emerald-950/60 text-emerald-100"
                        : "border-current text-[color:var(--live-muted)]"
                    }`}
                    aria-hidden="true"
                  >
                    {option.isCorrect ? "✓" : formatPersianNumber(option.position)}
                  </span>

                  {option.imageUrl && (
                    <PreviewImage
                      src={option.imageUrl}
                      alt=""
                      className="size-14 shrink-0 rounded-xl border border-[color:var(--live-border)] bg-black/10 object-cover"
                    />
                  )}

                  <span
                    className="min-w-0 flex-1 whitespace-pre-wrap text-sm font-bold leading-6 sm:text-base"
                    dir="auto"
                  >
                    {option.text || `گزینه ${formatPersianNumber(option.position)}`}
                  </span>

                  {option.isCorrect && (
                    <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-950/75 px-2 py-1 text-[11px] font-bold text-emerald-100">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      صحیح
                    </span>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>

        <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color:var(--live-border)] pt-3 text-xs font-bold text-[color:var(--live-muted)]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1">
            <ListChecks className="size-3.5" aria-hidden="true" />
            {preview.optionCountLabel}
          </span>
          {preview.fasterAnswersMorePoints && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1">
              <Zap className="size-3.5" aria-hidden="true" />
              امتیاز وابسته به سرعت
            </span>
          )}
          {preview.partialScoring && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1">
              امتیازدهی جزئی
            </span>
          )}
          {preview.showLeaderboardAfter && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1">
              <Trophy className="size-3.5" aria-hidden="true" />
              جدول امتیازات بعد از سؤال
            </span>
          )}
        </footer>
      </div>
    </section>
  );
}
