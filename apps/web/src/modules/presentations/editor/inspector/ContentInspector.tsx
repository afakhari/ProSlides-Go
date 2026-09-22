import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  X,
} from "lucide-react";

import { ApiError } from "../../../../shared/api/http.ts";
import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import Notice, {
  type NoticeTone,
} from "../../../../shared/ui/Notice.tsx";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import {
  CONTENT_LIMITS,
  type ContentValidationIssue,
  type EditorSlide,
} from "../../model/editor.ts";
import {
  contentDraftToEditorSlide,
  validateContentDraft,
} from "../model/contentDraft.ts";
import { useRequiredContentDraft } from "../model/useContentDraftContext.ts";
import ImageUrlDialog from "./ImageUrlDialog.tsx";

type ContentInspectorProps = {
  quizId: string;
  slide: EditorSlide;
  onClose: (forceClose?: boolean) => void;
  onSlideUpdated: (slide: EditorSlide) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onNotify?: (message: string, tone?: NoticeTone) => void;
  onConflict?: () => void | Promise<void>;
};

type ConfirmState =
  | { kind: "closed" }
  | { kind: "discard" }
  | { kind: "reload-conflict" };

const issueFor = (
  issues: ContentValidationIssue[],
  field: ContentValidationIssue["field"],
): string | null =>
  issues.find((issue) => issue.field === field)?.message ?? null;

const focusIssue = (issue: ContentValidationIssue | undefined) => {
  if (!issue || typeof document === "undefined") return;

  const target =
    issue.field === "title" || issue.field === "content"
      ? "content-editor-title"
      : issue.field === "content_text"
        ? "content-editor-text"
        : issue.field === "content_image"
          ? "content-editor-image"
          : null;

  if (!target) return;
  const element = document.getElementById(target);
  if (element instanceof HTMLElement) {
    element.focus();
    element.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
};

export default function ContentInspector({
  quizId,
  slide,
  onClose,
  onSlideUpdated,
  onDirtyChange,
  onNotify,
  onConflict,
}: ContentInspectorProps) {
  const {
    draft,
    dirty,
    reset,
    markSaved,
    setTitle,
    setText,
    setImage,
  } = useRequiredContentDraft();

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [conflictPending, setConflictPending] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    kind: "closed",
  });
  const titleRef = useRef<HTMLInputElement>(null);

  const validationIssues = useMemo(
    () => validateContentDraft(draft),
    [draft],
  );
  const visibleIssues = showValidation ? validationIssues : [];

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setConflictPending(false);
    setShowValidation(false);
  }, [slide.slide_id, slide.revision]);

  useEffect(() => {
    if (
      !draft.title.trim() &&
      !draft.text.trim() &&
      !draft.imageUrl.trim() &&
      !saving
    ) {
      titleRef.current?.focus();
    }
  }, [draft.imageUrl, draft.slideId, draft.text, draft.title, saving]);

  const notify = (
    message: string,
    tone: NoticeTone = "error",
  ) => {
    onNotify?.(message, tone);
  };

  const handleSave = async () => {
    if (!dirty || saving || conflictPending) return;

    const issues = validateContentDraft(draft);
    if (issues.length) {
      setShowValidation(true);
      notify(issues[0].message, "error");
      window.setTimeout(() => focusIssue(issues[0]), 0);
      return;
    }

    setSaving(true);
    try {
      const saved = await quizService.updateSlide(
        quizId,
        slide.slide_id,
        contentDraftToEditorSlide(draft),
      );

      markSaved(saved);
      onSlideUpdated(saved);
      onDirtyChange?.(false);
      setLastSavedAt(new Date());
      setShowValidation(false);
      notify("اسلاید محتوا ذخیره شد.", "success");
    } catch (error) {
      if (error instanceof ApiError && error.code === "edit_conflict") {
        setConflictPending(true);
        notify(
          "نسخه جدیدتری از این اسلاید روی سرور وجود دارد. تغییرات محلی شما حفظ شده است.",
          "warning",
        );
      } else if (
        error instanceof ApiError &&
        error.code === "slide_has_results"
      ) {
        notify(
          "این اسلاید در یک اجرای دارای نتیجه استفاده شده است. پیش از تغییر نوع یا ساختار، نتایج را بازنشانی کنید.",
          "warning",
        );
      } else if (error instanceof TypeError) {
        notify(
          "ارتباط با سرور برقرار نشد. تغییرات شما حفظ شده است؛ اتصال را بررسی و دوباره ذخیره کنید.",
          "error",
        );
      } else {
        notify("ذخیره اسلاید محتوا انجام نشد. تغییرات شما حفظ شده است.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const discardAndClose = () => {
    reset();
    onDirtyChange?.(false);
    setConfirmState({ kind: "closed" });
    onClose(true);
  };

  const handleClose = () => {
    if (saving) return;
    if (dirty) {
      setConfirmState({ kind: "discard" });
      return;
    }
    onClose(true);
  };

  const reloadConflict = async () => {
    await onConflict?.();
    onDirtyChange?.(false);
    setConflictPending(false);
    setConfirmState({ kind: "closed" });
    onClose(true);
  };

  const titleError =
    issueFor(visibleIssues, "title") ??
    issueFor(visibleIssues, "content");
  const textError = issueFor(visibleIssues, "content_text");
  const imageError = issueFor(visibleIssues, "content_image");
  const saveState = saving ? "saving" : dirty ? "dirty" : "saved";

  return (
    <>
      <aside
        className="flex h-full min-h-0 flex-col bg-surface text-content"
        aria-label="تنظیمات اسلاید محتوا"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-1 pb-4">
          <div>
            <h2 className="text-base font-bold">اسلاید محتوا</h2>
            <p className="mt-1 text-xs leading-5 text-content-muted">
              برای انتقال مفهوم، توضیح یا تصویر بین سؤال‌ها.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={saving}
            aria-label="بستن تنظیمات اسلاید محتوا"
            onClick={handleClose}
          >
            <X aria-hidden="true" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-5">
          {conflictPending && (
            <Notice
              tone="warning"
              className="mb-5 items-start"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setConfirmState({ kind: "reload-conflict" })
                  }
                >
                  بارگذاری نسخه سرور
                </Button>
              }
            >
              نسخه جدیدتری از این اسلاید ذخیره شده است. برای جلوگیری از
              بازنویسی ناخواسته، ذخیره دوباره تا تعیین تکلیف تعارض غیرفعال است.
            </Notice>
          )}

          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="content-editor-title"
                  className="text-sm font-semibold"
                >
                  عنوان
                </label>
                <span className="text-xs text-content-muted">
                  {formatPersianNumber(Array.from(draft.title).length)}
                  {" / "}
                  {formatPersianNumber(CONTENT_LIMITS.title)}
                </span>
              </div>
              <input
                ref={titleRef}
                id="content-editor-title"
                type="text"
                dir="auto"
                value={draft.title}
                maxLength={CONTENT_LIMITS.title}
                disabled={saving || conflictPending}
                aria-invalid={Boolean(titleError)}
                aria-describedby={
                  titleError ? "content-editor-title-error" : undefined
                }
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثلاً: نکته مهم"
                className="mt-2 h-11 w-full rounded-control border border-border-subtle bg-surface px-3 text-sm text-content outline-none transition placeholder:text-content-muted focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {titleError && (
                <p
                  id="content-editor-title-error"
                  role="alert"
                  className="mt-1.5 text-xs text-danger-ink"
                >
                  {titleError}
                </p>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="content-editor-text"
                  className="text-sm font-semibold"
                >
                  متن
                </label>
                <span className="text-xs text-content-muted">
                  {formatPersianNumber(Array.from(draft.text).length)}
                  {" / "}
                  {formatPersianNumber(CONTENT_LIMITS.text)}
                </span>
              </div>
              <textarea
                id="content-editor-text"
                dir="auto"
                rows={8}
                value={draft.text}
                maxLength={CONTENT_LIMITS.text}
                disabled={saving || conflictPending}
                aria-invalid={Boolean(textError)}
                aria-describedby={
                  textError ? "content-editor-text-error" : undefined
                }
                onChange={(event) => setText(event.target.value)}
                placeholder="توضیح، زمینه یا نکته‌ای که می‌خواهید شرکت‌کنندگان ببینند…"
                className="mt-2 min-h-40 w-full resize-y rounded-control border border-border-subtle bg-surface px-3 py-2.5 text-sm leading-6 text-content outline-none transition placeholder:text-content-muted focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {textError && (
                <p
                  id="content-editor-text-error"
                  role="alert"
                  className="mt-1.5 text-xs text-danger-ink"
                >
                  {textError}
                </p>
              )}
            </section>

            <section aria-labelledby="content-image-heading">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="content-image-heading" className="text-sm font-semibold">
                    تصویر
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-content-muted">
                    تصویر اختیاری است و پیش از استفاده بررسی می‌شود.
                  </p>
                </div>
                <Button
                  id="content-editor-image"
                  variant="outline"
                  size="sm"
                  disabled={saving || conflictPending}
                  onClick={() => setImageDialogOpen(true)}
                >
                  <ImageIcon aria-hidden="true" />
                  {draft.imageUrl ? "تغییر تصویر" : "افزودن تصویر"}
                </Button>
              </div>

              {draft.imageUrl && (
                <div className="mt-3 flex items-center gap-3 rounded-panel border border-border-subtle bg-canvas p-2">
                  <img
                    src={draft.imageUrl}
                    alt=""
                    className="size-20 shrink-0 rounded-control bg-surface object-cover"
                  />
                  <span
                    dir="ltr"
                    className="min-w-0 flex-1 truncate text-xs text-content-muted"
                  >
                    {draft.imageUrl}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={saving || conflictPending}
                    aria-label="حذف تصویر اسلاید محتوا"
                    className="shrink-0 text-danger"
                    onClick={() => setImage("")}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}
              {imageError && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {imageError}
                </p>
              )}
            </section>

            <Notice tone="info" className="items-start">
              حداقل یکی از عنوان، متن یا تصویر باید وجود داشته باشد. لازم نیست
              هر سه را پر کنید.
            </Notice>
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 border-t border-border-subtle bg-surface/95 px-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mb-2 min-h-5 text-xs">
            {saveState === "saving" ? (
              <span className="inline-flex items-center gap-1.5 text-info">
                <LoaderCircle
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                در حال ذخیره…
              </span>
            ) : saveState === "dirty" ? (
              <span className="font-medium text-warning-ink">
                تغییرات ذخیره‌نشده دارید.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-success-ink">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                همه تغییرات ذخیره شده است.
                {lastSavedAt && (
                  <span className="text-content-muted">
                    {" "}
                    {new Intl.DateTimeFormat("fa-IR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(lastSavedAt)}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={handleClose}
            >
              {dirty ? "انصراف" : "بستن"}
            </Button>
            <Button
              disabled={!dirty || saving || conflictPending}
              aria-busy={saving || undefined}
              onClick={() => void handleSave()}
            >
              {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
          </div>
        </footer>
      </aside>

      <ImageUrlDialog
        open={imageDialogOpen}
        initialUrl={draft.imageUrl}
        title="تصویر اسلاید محتوا"
        maxLength={CONTENT_LIMITS.imageUrl}
        onClose={() => setImageDialogOpen(false)}
        onConfirm={setImage}
      />

      <ConfirmDialog
        isOpen={confirmState.kind !== "closed"}
        onClose={() => setConfirmState({ kind: "closed" })}
        onConfirm={
          confirmState.kind === "reload-conflict"
            ? reloadConflict
            : discardAndClose
        }
        title={
          confirmState.kind === "reload-conflict"
            ? "نسخه جدید سرور بارگذاری شود؟"
            : "تغییرات کنار گذاشته شود؟"
        }
        description={
          confirmState.kind === "reload-conflict"
            ? "نسخه ذخیره‌شده روی سرور جایگزین ویرایش فعلی شما می‌شود و تغییرات محلی این پنل از بین می‌رود."
            : "تغییرات ذخیره‌نشده این اسلاید محتوا از بین می‌رود."
        }
        confirmText={
          confirmState.kind === "reload-conflict"
            ? "بارگذاری نسخه سرور"
            : "رد تغییرات"
        }
        cancelText="ادامه ویرایش"
        confirmVariant="destructive"
        isLoading={false}
      />
    </>
  );
}
