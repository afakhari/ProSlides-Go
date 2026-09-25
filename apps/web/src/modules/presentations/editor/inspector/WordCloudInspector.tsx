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
  TEXT_ACTIVITY_LIMITS,
  type EditorSlide,
  type TextActivityValidationIssue,
} from "../../model/editor.ts";
import {
  validateWordCloudDraft,
  wordCloudDraftToEditorSlide,
} from "../model/wordCloudDraft.ts";
import { useRequiredWordCloudDraft } from "../model/useWordCloudDraftContext.ts";
import ImageUrlDialog from "./ImageUrlDialog.tsx";

type WordCloudInspectorProps = {
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
  issues: TextActivityValidationIssue[],
  field: TextActivityValidationIssue["field"],
) => issues.find((issue) => issue.field === field)?.message ?? null;

export default function WordCloudInspector({
  quizId,
  slide,
  onClose,
  onSlideUpdated,
  onDirtyChange,
  onNotify,
  onConflict,
}: WordCloudInspectorProps) {
  const controller = useRequiredWordCloudDraft();
  const { draft, dirty } = controller;
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [conflictPending, setConflictPending] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    kind: "closed",
  });
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const validationIssues = useMemo(
    () => validateWordCloudDraft(draft),
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
    if (!draft.prompt.trim() && !saving) promptRef.current?.focus();
  }, [draft.prompt, draft.slideId, saving]);

  const notify = (message: string, tone: NoticeTone = "error") =>
    onNotify?.(message, tone);

  const handleSave = async () => {
    if (!dirty || saving || conflictPending) return;
    const issues = validateWordCloudDraft(draft);
    if (issues.length) {
      setShowValidation(true);
      notify(issues[0].message, "error");
      return;
    }

    setSaving(true);
    try {
      const saved = await quizService.updateSlide(
        quizId,
        slide.slide_id,
        wordCloudDraftToEditorSlide(draft),
      );
      controller.markSaved(saved);
      onSlideUpdated(saved);
      onDirtyChange?.(false);
      setShowValidation(false);
      setLastSavedAt(new Date());
      notify("ابر واژه ذخیره شد.", "success");
    } catch (error) {
      if (error instanceof ApiError && error.code === "edit_conflict") {
        setConflictPending(true);
        notify(
          "نسخه جدیدتری روی سرور وجود دارد. تغییرات محلی شما حفظ شده است.",
          "warning",
        );
      } else if (
        error instanceof ApiError &&
        error.code === "slide_has_results"
      ) {
        notify(
          "این فعالیت نتیجه زنده دارد. پیش از تغییر ساختار، نتایج ارائه را بازنشانی کنید.",
          "warning",
        );
      } else if (error instanceof TypeError) {
        notify(
          "ارتباط با سرور برقرار نشد. تغییرات شما حفظ شده است.",
          "error",
        );
      } else {
        notify("ذخیره ابر واژه انجام نشد. تغییرات شما حفظ شده است.", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const discardAndClose = () => {
    controller.reset();
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

  const promptError =
    issueFor(visibleIssues, "prompt_text") ??
    issueFor(visibleIssues, "text_activity");
  const imageError = issueFor(visibleIssues, "prompt_image");
  const maxLengthError = issueFor(visibleIssues, "max_length");
  const maxWordsError = issueFor(visibleIssues, "max_words");
  const durationError = issueFor(visibleIssues, "duration");

  return (
    <>
      <aside
        className="flex h-full min-h-0 flex-col bg-surface text-content"
        aria-label="تنظیمات ابر واژه"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-1 pb-4">
          <div>
            <h2 className="text-base font-bold">ابر واژه</h2>
            <p className="mt-1 text-xs leading-5 text-content-muted">
              پاسخ‌های متنی کوتاه بر اساس فراوانی واژه‌ها تجمیع می‌شوند.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={saving}
            aria-label="بستن تنظیمات ابر واژه"
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
              ذخیره تا تعیین تکلیف تعارض غیرفعال است.
            </Notice>
          )}

          <div className="space-y-6">
            <section>
              <label
                htmlFor="word-cloud-title"
                className="text-sm font-semibold"
              >
                عنوان کوتاه <span className="text-content-muted">(اختیاری)</span>
              </label>
              <input
                id="word-cloud-title"
                dir="auto"
                value={draft.title}
                maxLength={TEXT_ACTIVITY_LIMITS.title}
                disabled={saving || conflictPending}
                onChange={(event) => controller.setTitle(event.target.value)}
                placeholder="مثلاً: نظر جمع"
                className="mt-2 h-11 w-full rounded-control border border-border-subtle bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="word-cloud-prompt"
                  className="text-sm font-semibold"
                >
                  پرسش
                </label>
                <span className="text-xs text-content-muted">
                  {formatPersianNumber(Array.from(draft.prompt).length)}
                  {" / "}
                  {formatPersianNumber(TEXT_ACTIVITY_LIMITS.promptText)}
                </span>
              </div>
              <textarea
                ref={promptRef}
                id="word-cloud-prompt"
                dir="auto"
                rows={4}
                value={draft.prompt}
                maxLength={TEXT_ACTIVITY_LIMITS.promptText}
                disabled={saving || conflictPending}
                aria-invalid={Boolean(promptError)}
                onChange={(event) => controller.setPrompt(event.target.value)}
                placeholder="مثلاً: این جلسه را با چه واژه‌هایی توصیف می‌کنید؟"
                className="mt-2 min-h-28 w-full resize-y rounded-control border border-border-subtle bg-surface px-3 py-2.5 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {promptError && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {promptError}
                </p>
              )}
            </section>

            <section aria-labelledby="word-cloud-response-heading">
              <h3 id="word-cloud-response-heading" className="text-sm font-semibold">
                محدودیت پاسخ
              </h3>
              <p className="mt-1 text-xs leading-5 text-content-muted">
                پاسخ هر شرکت‌کننده یک بار ثبت می‌شود؛ واژه تکراری در همان پاسخ
                دوباره شمرده نمی‌شود.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold">
                  تعداد واژه
                  <input
                    type="number"
                    inputMode="numeric"
                    min={TEXT_ACTIVITY_LIMITS.minWords}
                    max={TEXT_ACTIVITY_LIMITS.maxWords}
                    value={draft.maxWords}
                    disabled={saving || conflictPending}
                    aria-invalid={Boolean(maxWordsError)}
                    onChange={(event) =>
                      controller.setMaxWords(Number(event.target.value))
                    }
                    className="mt-1.5 h-11 w-full rounded-control border border-border-subtle bg-surface px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-semibold">
                  حداکثر نویسه
                  <input
                    type="number"
                    inputMode="numeric"
                    min={TEXT_ACTIVITY_LIMITS.minResponseLength}
                    max={TEXT_ACTIVITY_LIMITS.maxResponseLength}
                    value={draft.maxLength}
                    disabled={saving || conflictPending}
                    aria-invalid={Boolean(maxLengthError)}
                    onChange={(event) =>
                      controller.setMaxLength(Number(event.target.value))
                    }
                    className="mt-1.5 h-11 w-full rounded-control border border-border-subtle bg-surface px-3 text-sm"
                  />
                </label>
              </div>
              {(maxWordsError || maxLengthError) && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {maxWordsError || maxLengthError}
                </p>
              )}
            </section>

            <section>
              <label htmlFor="word-cloud-duration" className="text-sm font-semibold">
                زمان پاسخ‌گویی
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="word-cloud-duration"
                  type="number"
                  inputMode="numeric"
                  min={TEXT_ACTIVITY_LIMITS.minDurationSeconds}
                  max={TEXT_ACTIVITY_LIMITS.maxDurationSeconds}
                  value={draft.durationSeconds}
                  disabled={saving || conflictPending}
                  aria-invalid={Boolean(durationError)}
                  onChange={(event) =>
                    controller.setDurationSeconds(Number(event.target.value))
                  }
                  className="h-11 min-w-0 flex-1 rounded-control border border-border-subtle bg-surface px-3 text-sm"
                />
                <span className="text-sm text-content-muted">ثانیه</span>
              </div>
              {durationError && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {durationError}
                </p>
              )}
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">تصویر پرسش</h3>
                  <p className="mt-1 text-xs text-content-muted">اختیاری</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving || conflictPending}
                  onClick={() => setImageDialogOpen(true)}
                >
                  <ImageIcon aria-hidden="true" />
                  {draft.imageUrl ? "تغییر تصویر" : "افزودن تصویر"}
                </Button>
              </div>
              {imageError && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {imageError}
                </p>
              )}
            </section>

            <Notice tone="info" className="items-start">
              این فعالیت پاسخ صحیح و امتیاز ندارد. نتیجه فقط ابر واژه همین
              فعالیت است و رتبه‌بندی کلی جلسه را تغییر نمی‌دهد.
            </Notice>
          </div>
        </div>

        <footer className="sticky bottom-0 z-10 border-t border-border-subtle bg-surface/95 px-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mb-2 min-h-5 text-xs">
            {saving ? (
              <span className="inline-flex items-center gap-1.5 text-info">
                <LoaderCircle
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                در حال ذخیره…
              </span>
            ) : dirty ? (
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
            <Button variant="outline" disabled={saving} onClick={handleClose}>
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
        title="تصویر پرسش ابر واژه"
        maxLength={TEXT_ACTIVITY_LIMITS.imageUrl}
        onClose={() => setImageDialogOpen(false)}
        onConfirm={controller.setImage}
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
            ? "نسخه ذخیره‌شده روی سرور جایگزین ویرایش فعلی شما می‌شود."
            : "تغییرات ذخیره‌نشده ابر واژه از بین می‌رود."
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
