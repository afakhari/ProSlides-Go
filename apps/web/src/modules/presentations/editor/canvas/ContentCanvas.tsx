import { useEffect, useMemo, useState } from "react";
import { FileText, ImageOff } from "lucide-react";

import { presentationTheme } from "../../../../shared/styles/presentationTheme.ts";
import type { EditorSlide } from "../../model/editor.ts";
import { createContentDraft } from "../model/contentDraft.ts";
import { createContentPreviewModel } from "../model/contentPreview.ts";
import { useOptionalContentDraft } from "../model/useContentDraftContext.ts";

type ContentCanvasProps = {
  slide: EditorSlide;
  quizBackground?: string;
  quizBackgroundImage?: string;
  textColor?: string;
};

function ContentPreviewImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label="تصویر قابل نمایش نیست"
        className="mx-auto grid min-h-44 w-full max-w-3xl place-items-center rounded-2xl border border-[color:var(--live-border)] bg-black/20 text-[color:var(--live-muted)]"
      >
        <span className="flex flex-col items-center gap-2 px-4 text-center text-sm font-bold">
          <ImageOff className="size-6" aria-hidden="true" />
          تصویر بارگذاری نشد
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="mx-auto max-h-[48vh] w-auto max-w-full rounded-2xl border border-[color:var(--live-border)] bg-black/10 object-contain shadow-xl"
    />
  );
}

export default function ContentCanvas({
  slide,
  quizBackground,
  quizBackgroundImage,
  textColor = "#111827",
}: ContentCanvasProps) {
  const controller = useOptionalContentDraft();
  const persistedDraft = useMemo(
    () => createContentDraft(slide),
    [slide],
  );
  const draft =
    controller?.draft?.slideId === slide.slide_id
      ? controller.draft
      : persistedDraft;

  const preview = useMemo(
    () => (draft ? createContentPreviewModel(draft) : null),
    [draft],
  );

  const theme = useMemo(
    () =>
      presentationTheme({
        background: {
          color: quizBackground,
          image: quizBackgroundImage,
          text_color: textColor,
        },
        text_color: textColor,
      }),
    [quizBackground, quizBackgroundImage, textColor],
  );

  if (!draft || !preview) return null;

  const displayTitle = preview.hasTitle
    ? preview.title
    : "مطلب بعدی";

  return (
    <section
      aria-label="پیش‌نمایش اسلاید محتوا"
      className="relative flex h-full max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] border border-[color:var(--live-border)] bg-cover bg-center text-[color:var(--live-fg)] shadow-2xl"
      style={theme.style}
    >
      <div className="flex min-h-0 flex-1 flex-col p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--live-border)] bg-black/25 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
            <FileText className="size-3.5" aria-hidden="true" />
            پیش‌نمایش شرکت‌کننده
          </span>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            {controller?.dirty && (
              <span className="rounded-full border border-warning-border bg-warning-soft px-3 py-1.5 text-warning-ink">
                تغییرات ذخیره‌نشده
              </span>
            )}
            {preview.validationIssueCount > 0 && (
              <span className="rounded-full border border-danger-border bg-danger-soft px-3 py-1.5 text-danger-ink">
                نیازمند تکمیل
              </span>
            )}
          </div>
        </div>

        <article className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col justify-center overflow-y-auto py-6 text-center">
          <p className="mb-3 text-sm font-bold text-[color:var(--live-muted)]">
            اسلاید توضیحی
          </p>

          <h2
            dir="auto"
            className="whitespace-pre-wrap text-3xl font-black leading-[1.45] sm:text-4xl"
          >
            {displayTitle}
          </h2>

          {preview.hasImage && (
            <div className="mt-6">
              <ContentPreviewImage
                src={preview.imageUrl}
                alt={preview.hasTitle ? `تصویر ${preview.title}` : "تصویر اسلاید محتوا"}
              />
            </div>
          )}

          {preview.hasText && (
            <p
              dir="auto"
              className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-base leading-8 text-[color:var(--live-muted)] sm:text-lg sm:leading-9"
            >
              {preview.text}
            </p>
          )}

          {!preview.hasTitle && !preview.hasText && !preview.hasImage && (
            <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-[color:var(--live-border)] bg-black/20 px-5 py-7 text-sm font-bold text-[color:var(--live-muted)]">
              عنوان، متن یا تصویر اضافه کنید تا پیش‌نمایش اینجا نمایش داده شود.
            </div>
          )}

          <div className="mx-auto mt-7 inline-flex rounded-full border border-[color:var(--live-border)] bg-white/10 px-4 py-2 text-sm font-bold">
            برای ادامه، نمایشگر ارائه‌دهنده را دنبال کنید
          </div>
        </article>
      </div>
    </section>
  );
}
