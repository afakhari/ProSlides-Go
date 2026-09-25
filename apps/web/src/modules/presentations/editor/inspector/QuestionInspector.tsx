import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  X,
} from "lucide-react";

import { ApiError } from "../../../../shared/api/http.ts";
import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import Notice from "../../../../shared/ui/Notice.tsx";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import {
  QUESTION_LIMITS,
  type EditorSlide,
  type QuestionValidationIssue,
} from "../../model/editor.ts";
import {
  questionDraftToEditorSlide,
  validateQuestionDraft,
} from "../model/questionDraft.ts";
import { useRequiredQuestionDraft } from "../model/useQuestionDraftContext.ts";
import ImageUrlDialog from "./ImageUrlDialog.tsx";
import QuestionOptionsEditor from "./QuestionOptionsEditor.tsx";

type NoticeTone = "info" | "success" | "warning" | "error";

type QuestionInspectorProps = {
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

type ImageTarget =
  | { kind: "question" }
  | { kind: "option"; optionId: string }
  | null;

const issueFor = (
  issues: QuestionValidationIssue[],
  field: QuestionValidationIssue["field"],
): string | null => issues.find((issue) => issue.field === field)?.message ?? null;

const focusIssue = (issue: QuestionValidationIssue | undefined) => {
  if (!issue || typeof document === "undefined") return;

  const target =
    issue.field === "question_text"
      ? "question-editor-text"
      : issue.field === "question_time"
        ? "question-editor-time"
        : issue.field === "points"
          ? "question-editor-max-points"
          : issue.field === "option_text" && issue.optionId
            ? `question-option-${issue.optionId}`
            : issue.field === "options"
              ? "question-options-heading"
              : null;

  if (!target) return;
  const element = document.getElementById(target);
  if (element instanceof HTMLElement) {
    element.focus();
    element.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
};

function QuestionInspectorInner({
  quizId,
  slide,
  onClose,
  onSlideUpdated,
  onDirtyChange,
  onNotify,
  onConflict,
}: QuestionInspectorProps) {
  const {
    draft,
    dirty,
    reset,
    markSaved,
    setQuestionText,
    setQuestionImage,
    setTimeInput,
    setMinPointsInput,
    setMaxPointsInput,
    setFasterPoints,
    setPartialScoring,
    setLeaderboard,
    addOption,
    deleteOption,
    setOptionText,
    setOptionImage,
    toggleCorrect,
    moveOption,
  } = useRequiredQuestionDraft();

  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [conflictPending, setConflictPending] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    kind: "closed",
  });
  const [imageTarget, setImageTarget] = useState<ImageTarget>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  const validationIssues = useMemo(
    () => validateQuestionDraft(draft),
    [draft],
  );
  const visibleIssues = showValidation ? validationIssues : [];

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!draft.text.trim() && !isSaving) {
      questionInputRef.current?.focus();
    }
  }, [draft.slideId, draft.text, isSaving]);

  useEffect(() => {
    setConflictPending(false);
    setShowValidation(false);
  }, [slide.slide_id, slide.revision]);

  const notify = (message: string, tone: NoticeTone = "error") => {
    onNotify?.(message, tone);
  };

  const handleSave = async () => {
    if (!dirty || isSaving || conflictPending) return;

    const issues = validateQuestionDraft(draft);
    if (issues.length) {
      setShowValidation(true);
      notify(issues[0].message, "error");
      window.setTimeout(() => focusIssue(issues[0]), 0);
      return;
    }

    setIsSaving(true);
    try {
      const savedSlide = await quizService.updateSlide(
        quizId,
        slide.slide_id,
        questionDraftToEditorSlide(draft),
      );

      markSaved(savedSlide);
      onSlideUpdated(savedSlide);
      onDirtyChange?.(false);
      setLastSavedAt(new Date());
      setShowValidation(false);
      notify("تغییرات سؤال ذخیره شد.", "success");
    } catch (error) {
      if (error instanceof ApiError && error.code === "edit_conflict") {
        setConflictPending(true);
        notify(
          "نسخه جدیدتری از این سؤال روی سرور وجود دارد. تغییرات محلی شما هنوز در این پنل نگه داشته شده است.",
          "warning",
        );
      } else if (
        error instanceof ApiError &&
        error.code === "slide_has_results"
      ) {
        notify(
          "این سؤال پاسخ زنده ثبت‌شده دارد. پیش از تغییر محتوای سؤال، نتایج ارائه را بازنشانی کنید.",
          "warning",
        );
      } else if (error instanceof TypeError) {
        notify(
          "ارتباط با سرور برقرار نشد. تغییرات شما حفظ شده است؛ اتصال را بررسی و دوباره ذخیره کنید.",
          "error",
        );
      } else {
        notify("ذخیره تغییرات انجام نشد. تغییرات شما حفظ شده است.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const discardAndClose = () => {
    reset();
    onDirtyChange?.(false);
    setConfirmState({ kind: "closed" });
    onClose(true);
  };

  const handleClose = () => {
    if (isSaving) return;
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

  const currentImageUrl =
    imageTarget?.kind === "question"
      ? draft.imageUrl
      : imageTarget?.kind === "option"
        ? draft.options.find((option) => option.id === imageTarget.optionId)
            ?.imageUrl || ""
        : "";

  const applyImage = (url: string) => {
    if (imageTarget?.kind === "question") {
      setQuestionImage(url);
    } else if (imageTarget?.kind === "option") {
      setOptionImage(imageTarget.optionId, url);
    }
  };

  const questionTextError = issueFor(visibleIssues, "question_text");
  const questionImageError = issueFor(visibleIssues, "question_image");
  const timeError = issueFor(visibleIssues, "question_time");
  const pointsError = issueFor(visibleIssues, "points");
  const partialError = issueFor(visibleIssues, "partial_scoring");
  const saveState = isSaving ? "saving" : dirty ? "dirty" : "saved";

  return (
    <>
      <aside
        className="flex h-full min-h-0 flex-col bg-surface text-content"
        aria-label="تنظیمات سؤال"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-1 pb-4">
          <div>
            <h2 className="text-base font-bold">تنظیمات سؤال</h2>
            <p className="mt-1 text-xs text-content-muted">
              {draft.type === "single"
                ? "سؤال تک‌گزینه‌ای"
                : "سؤال چندگزینه‌ای"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={isSaving}
            aria-label="بستن تنظیمات سؤال"
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
                  onClick={() => setConfirmState({ kind: "reload-conflict" })}
                >
                  بارگذاری نسخه سرور
                </Button>
              }
            >
              نسخه جدیدتری از این سؤال ذخیره شده است. برای جلوگیری از بازنویسی ناخواسته،
              ذخیره دوباره تا تعیین تکلیف این تعارض غیرفعال است.
            </Notice>
          )}

          <div className="space-y-7">
            <section aria-labelledby="question-text-heading">
              <div className="flex items-center justify-between gap-3">
                <label
                  id="question-text-heading"
                  htmlFor="question-editor-text"
                  className="text-sm font-semibold"
                >
                  متن سؤال
                </label>
                <span className="text-xs text-content-muted">
                  {formatPersianNumber(Array.from(draft.text).length)}
                  {" / "}
                  {formatPersianNumber(QUESTION_LIMITS.text)}
                </span>
              </div>

              <div className="mt-2 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <textarea
                    ref={questionInputRef}
                    id="question-editor-text"
                    dir="auto"
                    rows={3}
                    value={draft.text}
                    maxLength={QUESTION_LIMITS.text}
                    disabled={isSaving || conflictPending}
                    aria-invalid={Boolean(questionTextError)}
                    aria-describedby={
                      questionTextError ? "question-editor-text-error" : undefined
                    }
                    onChange={(event) => setQuestionText(event.target.value)}
                    placeholder="سؤال خود را بنویسید…"
                    className="min-h-24 w-full resize-y rounded-control border border-border-subtle bg-surface px-3 py-2.5 text-sm leading-6 text-content outline-none transition placeholder:text-content-muted focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {questionTextError && (
                    <p
                      id="question-editor-text-error"
                      role="alert"
                      className="mt-1.5 text-xs text-danger-ink"
                    >
                      {questionTextError}
                    </p>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  disabled={isSaving || conflictPending}
                  aria-label="افزودن یا تغییر تصویر سؤال"
                  onClick={() => setImageTarget({ kind: "question" })}
                >
                  <ImageIcon aria-hidden="true" />
                </Button>
              </div>

              {draft.imageUrl && (
                <div className="mt-3 flex items-center gap-3 rounded-panel border border-border-subtle bg-canvas p-2">
                  <img
                    src={draft.imageUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-control bg-surface object-cover"
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
                    disabled={isSaving || conflictPending}
                    aria-label="حذف تصویر سؤال"
                    className="shrink-0 text-danger"
                    onClick={() => setQuestionImage("")}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}
              {questionImageError && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {questionImageError}
                </p>
              )}
            </section>

            <QuestionOptionsEditor
              options={draft.options}
              questionType={draft.type}
              disabled={isSaving || conflictPending}
              issues={visibleIssues}
              onAdd={addOption}
              onDelete={deleteOption}
              onTextChange={setOptionText}
              onToggleCorrect={toggleCorrect}
              onMove={moveOption}
              onImage={(optionId) =>
                setImageTarget({ kind: "option", optionId })
              }
              onRemoveImage={(optionId) => setOptionImage(optionId, "")}
            />

            <section aria-labelledby="question-time-heading">
              <h3 id="question-time-heading" className="text-sm font-semibold">
                زمان پاسخ
              </h3>
              <div className="mt-2 flex items-center gap-3">
                <div>
                  <label htmlFor="question-editor-time" className="sr-only">
                    زمان پاسخ به ثانیه
                  </label>
                  <input
                    id="question-editor-time"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={draft.timeInput}
                    disabled={isSaving || conflictPending}
                    aria-invalid={Boolean(timeError)}
                    aria-describedby={
                      timeError
                        ? "question-editor-time-error"
                        : "question-editor-time-help"
                    }
                    onChange={(event) => setTimeInput(event.target.value)}
                    className="h-10 w-24 rounded-control border border-border-subtle bg-surface px-3 text-center text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <p id="question-editor-time-help" className="text-xs leading-5 text-content-muted">
                  ثانیه، از ۱ تا ۸۶۴۰۰
                </p>
              </div>
              {timeError && (
                <p id="question-editor-time-error" role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {timeError}
                </p>
              )}
            </section>

            <section aria-labelledby="question-scoring-heading">
              <div>
                <h3 id="question-scoring-heading" className="text-sm font-semibold">
                  امتیازدهی
                </h3>
                <p className="mt-1 text-xs leading-5 text-content-muted">
                  حداکثر امتیاز برای پاسخ صحیح است. حداقل امتیاز فقط وقتی سرعت پاسخ
                  در امتیاز اثر دارد استفاده می‌شود.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="question-editor-max-points"
                    className="mb-1 block text-xs font-medium text-content-muted"
                  >
                    حداکثر امتیاز
                  </label>
                  <input
                    id="question-editor-max-points"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={draft.maxPointsInput}
                    disabled={isSaving || conflictPending}
                    aria-invalid={Boolean(pointsError)}
                    onChange={(event) => setMaxPointsInput(event.target.value)}
                    className="h-10 w-full rounded-control border border-border-subtle bg-surface px-3 text-center text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
                <div>
                  <label
                    htmlFor="question-editor-min-points"
                    className="mb-1 block text-xs font-medium text-content-muted"
                  >
                    حداقل امتیاز
                  </label>
                  <input
                    id="question-editor-min-points"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    value={draft.minPointsInput}
                    disabled={
                      isSaving ||
                      conflictPending ||
                      !draft.fasterAnswersMorePoints
                    }
                    aria-invalid={Boolean(pointsError)}
                    onChange={(event) => setMinPointsInput(event.target.value)}
                    className="h-10 w-full rounded-control border border-border-subtle bg-surface px-3 text-center text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-content-muted"
                  />
                </div>
              </div>
              {pointsError && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {pointsError}
                </p>
              )}

              <label className="mt-4 flex min-h-12 cursor-pointer items-start justify-between gap-4 rounded-panel border border-border-subtle bg-canvas p-3">
                <span>
                  <span className="block text-sm font-medium">
                    پاسخ سریع‌تر، امتیاز بیشتر
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-content-muted">
                    امتیاز بین حداقل و حداکثر بر اساس زمان باقی‌مانده محاسبه می‌شود.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.fasterAnswersMorePoints}
                  disabled={isSaving || conflictPending}
                  onChange={(event) => setFasterPoints(event.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-brand"
                />
              </label>

              <label
                className={`mt-3 flex min-h-12 items-start justify-between gap-4 rounded-panel border border-border-subtle p-3 ${
                  draft.type === "single"
                    ? "cursor-not-allowed bg-canvas opacity-70"
                    : "cursor-pointer bg-canvas"
                }`}
              >
                <span>
                  <span className="block text-sm font-medium">امتیازدهی جزئی</span>
                  <span className="mt-1 block text-xs leading-5 text-content-muted">
                    در سؤال چندگزینه‌ای، پاسخ‌های درست امتیاز می‌گیرند و انتخاب‌های
                    نادرست از امتیاز کم می‌کنند.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.partialScoring}
                  disabled={
                    isSaving || conflictPending || draft.type === "single"
                  }
                  onChange={(event) => setPartialScoring(event.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-brand"
                />
              </label>
              {partialError && (
                <p role="alert" className="mt-1.5 text-xs text-danger-ink">
                  {partialError}
                </p>
              )}
            </section>

            <section aria-labelledby="question-flow-heading">
              <h3 id="question-flow-heading" className="text-sm font-semibold">
                پس از فعالیت
              </h3>
              <Notice tone="info" className="mt-2 items-start">
                نتیجه همین فعالیت، شامل توزیع پاسخ‌ها و پاسخ صحیح، پس از
                بسته‌شدن Activity نمایش داده می‌شود. این مرحله از رتبه‌بندی
                کلی جلسه جداست.
              </Notice>
              <label className="mt-3 flex min-h-12 cursor-pointer items-start justify-between gap-4 rounded-panel border border-border-subtle bg-canvas p-3">
                <span>
                  <span className="block text-sm font-medium">
                    نمایش رتبه‌بندی کلی بعد از نتیجه
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-content-muted">
                    پس از نمایش نتیجه این فعالیت، رتبه‌بندی تجمعی کل جلسه نیز
                    روی Stage نمایش داده می‌شود.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={draft.showLeaderboardAfter}
                  disabled={isSaving || conflictPending}
                  onChange={(event) => setLeaderboard(event.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-brand"
                />
              </label>
            </section>
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
              disabled={isSaving}
              onClick={handleClose}
            >
              {dirty ? "انصراف" : "بستن"}
            </Button>
            <Button
              disabled={!dirty || isSaving || conflictPending}
              aria-busy={isSaving || undefined}
              onClick={() => void handleSave()}
            >
              {isSaving ? "در حال ذخیره…" : "ذخیره تغییرات"}
            </Button>
          </div>
        </footer>
      </aside>

      <ImageUrlDialog
        open={imageTarget !== null}
        initialUrl={currentImageUrl}
        title={
          imageTarget?.kind === "question"
            ? "تصویر سؤال"
            : "تصویر گزینه"
        }
        onClose={() => setImageTarget(null)}
        onConfirm={applyImage}
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
            : "تغییرات ذخیره‌نشده این سؤال از بین می‌رود."
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

export default function QuestionInspector(props: QuestionInspectorProps) {
  if (!props.slide || props.slide.slide_type !== 1 || !props.slide.question) {
    return (
      <Notice tone="warning" className="m-3">
        برای ویرایش، ابتدا یک اسلاید سؤال معتبر انتخاب کنید.
      </Notice>
    );
  }

  return <QuestionInspectorInner {...props} />;
}
