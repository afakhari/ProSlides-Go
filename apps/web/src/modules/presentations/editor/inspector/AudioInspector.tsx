import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  Music2,
  Trash2,
  Volume2,
  X,
} from "lucide-react";

import { ApiError } from "../../../../shared/api/http.ts";
import Notice, {
  type NoticeTone,
} from "../../../../shared/ui/Notice.tsx";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import type { EditorPresentation } from "../../model/editor.ts";
import {
  AUDIO_LIMITS,
  audioDraftToUpdate,
  validateAudioDraft,
} from "../model/audioDraft.ts";
import { useAudioDraft } from "../model/useAudioDraft.ts";

type AudioInspectorProps = {
  quiz: EditorPresentation;
  onClose: (forceClose?: boolean) => void;
  onQuizUpdated: (quiz: EditorPresentation) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onNotify?: (message: string, tone?: NoticeTone) => void;
  onConflict?: () => void | Promise<void>;
};

type ConfirmState =
  | { kind: "closed" }
  | { kind: "discard" }
  | { kind: "reload-conflict" };

type PreviewState = "idle" | "loading" | "ready" | "error";

const formatNumber = (value: number): string =>
  new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(value);

export default function AudioInspector({
  quiz,
  onClose,
  onQuizUpdated,
  onDirtyChange,
  onNotify,
  onConflict,
}: AudioInspectorProps) {
  const {
    draft,
    dirty,
    setMusicUrl,
    reset,
    markSaved,
  } = useAudioDraft(quiz);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [conflictPending, setConflictPending] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    kind: "closed",
  });

  const issues = useMemo(
    () => validateAudioDraft(draft),
    [draft],
  );
  const fieldError = issues.find((issue) => issue.field === "music_url");
  const normalizedUrl = draft.musicUrl.trim();
  const canPreview = Boolean(normalizedUrl) && !fieldError;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setConflictPending(false);
  }, [draft.presentationId, draft.revision]);

  useEffect(() => {
    audioRef.current?.pause();
    setPreviewState(canPreview ? "loading" : "idle");
  }, [canPreview, normalizedUrl]);

  const notify = (
    message: string,
    tone: NoticeTone = "error",
  ) => {
    onNotify?.(message, tone);
  };

  const handleSave = async () => {
    if (!dirty || saving || conflictPending) return;
    if (issues.length) {
      notify(issues[0].message, "error");
      return;
    }

    setSaving(true);
    try {
      const update = audioDraftToUpdate(draft);
      const saved = await quizService.updateQuizMusic(
        draft.presentationId,
        update.music_url,
        update.revision,
      );
      markSaved(saved);
      onQuizUpdated(saved);
      onDirtyChange?.(false);
      setLastSavedAt(new Date());
      notify(
        update.music_url
          ? "صدای ارائه ذخیره شد."
          : "صدای ارائه حذف شد.",
        "success",
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "edit_conflict") {
        setConflictPending(true);
        notify(
          "نسخه جدیدتری از تنظیمات ارائه روی سرور وجود دارد. تغییرات صدای محلی شما حفظ شده است.",
          "warning",
        );
      } else if (error instanceof TypeError) {
        notify(
          "ارتباط با سرور برقرار نشد. تغییرات صدای شما حفظ شده است.",
          "error",
        );
      } else {
        notify(
          "ذخیره صدای ارائه انجام نشد. تغییرات شما حفظ شده است.",
          "error",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const discardAndClose = () => {
    audioRef.current?.pause();
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
    audioRef.current?.pause();
    onClose(true);
  };

  const reloadConflict = async () => {
    audioRef.current?.pause();
    await onConflict?.();
    onDirtyChange?.(false);
    setConflictPending(false);
    setConfirmState({ kind: "closed" });
    onClose(true);
  };

  const removeAudio = () => {
    audioRef.current?.pause();
    setMusicUrl("");
  };

  const saveState = saving ? "saving" : dirty ? "dirty" : "saved";

  return (
    <>
      <aside
        className="flex h-full min-h-0 flex-col bg-surface text-content"
        aria-label="تنظیمات صدای ارائه"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-1 pb-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Music2 className="size-5 text-brand" aria-hidden="true" />
              صدای ارائه
            </h2>
            <p className="mt-1 text-xs leading-5 text-content-muted">
              یک فایل صوتی HTTP(S) برای پخش در اجرای زنده انتخاب کنید. پخش خودکار به سیاست مرورگر کاربر وابسته است.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={saving}
            aria-label="بستن تنظیمات صدای ارائه"
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
              تنظیمات ارائه جای دیگری تغییر کرده است. برای جلوگیری از بازنویسی ناخواسته، ذخیره دوباره تا تعیین تکلیف تعارض غیرفعال است.
            </Notice>
          )}

          <div className="space-y-6">
            <section aria-labelledby="audio-source-heading">
              <div>
                <h3
                  id="audio-source-heading"
                  className="text-sm font-semibold"
                >
                  آدرس فایل صوتی
                </h3>
                <p className="mt-1 text-xs leading-5 text-content-muted">
                  پیوند مستقیم فایل یا stream سازگار با مرورگر را وارد کنید. آدرس‌های غیر HTTP(S) پذیرفته نمی‌شوند.
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <label
                  htmlFor="presentation-audio-url"
                  className="text-xs font-medium text-content-muted"
                >
                  نشانی صدا
                </label>
                <span className="text-xs text-content-muted">
                  {formatNumber(Array.from(draft.musicUrl).length)}
                  {" / "}
                  {formatNumber(AUDIO_LIMITS.url)}
                </span>
              </div>
              <input
                id="presentation-audio-url"
                type="url"
                inputMode="url"
                dir="ltr"
                value={draft.musicUrl}
                maxLength={AUDIO_LIMITS.url}
                disabled={saving || conflictPending}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={
                  fieldError
                    ? "presentation-audio-url-error presentation-audio-url-help"
                    : "presentation-audio-url-help"
                }
                onChange={(event) => setMusicUrl(event.target.value)}
                placeholder="https://example.com/audio.mp3"
                className="mt-2 h-11 w-full rounded-control border border-border-subtle bg-surface px-3 text-start text-sm text-content outline-none transition placeholder:text-content-muted focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p
                id="presentation-audio-url-help"
                className="mt-2 text-xs leading-5 text-content-muted"
              >
                خالی گذاشتن این فیلد یعنی ارائه بدون موسیقی پس‌زمینه اجرا می‌شود.
              </p>
              {fieldError && (
                <p
                  id="presentation-audio-url-error"
                  className="mt-2 text-xs font-medium text-danger"
                  role="alert"
                >
                  {fieldError.message}
                </p>
              )}
            </section>

            <section aria-labelledby="audio-preview-heading">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3
                    id="audio-preview-heading"
                    className="text-sm font-semibold"
                  >
                    پیش‌نمایش
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-content-muted">
                    پیش‌نمایش در مرورگر فعلی فقط برای بررسی فایل است و وضعیت دسترسی کاربران دیگر را تضمین نمی‌کند.
                  </p>
                </div>
                {normalizedUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    disabled={saving || conflictPending}
                    onClick={removeAudio}
                  >
                    <Trash2 aria-hidden="true" />
                    حذف صدا
                  </Button>
                )}
              </div>

              {canPreview ? (
                <div className="mt-3 rounded-panel border border-border-subtle bg-canvas p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-content-muted">
                    <Volume2 className="size-4" aria-hidden="true" />
                    <span dir="ltr" className="min-w-0 truncate">
                      {normalizedUrl}
                    </span>
                  </div>
                  <audio
                    key={normalizedUrl}
                    ref={audioRef}
                    src={normalizedUrl}
                    controls
                    preload="metadata"
                    aria-label="پیش‌نمایش صدای ارائه"
                    className="w-full"
                    onLoadStart={() => setPreviewState("loading")}
                    onCanPlay={() => setPreviewState("ready")}
                    onError={() => setPreviewState("error")}
                  >
                    مرورگر شما پخش صوت را پشتیبانی نمی‌کند.
                  </audio>

                  <div className="mt-3 min-h-5 text-xs">
                    {previewState === "loading" && (
                      <span
                        className="inline-flex items-center gap-1.5 text-info"
                        role="status"
                        aria-live="polite"
                      >
                        <LoaderCircle
                          className="size-3.5 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                        در حال آماده‌سازی پیش‌نمایش…
                      </span>
                    )}
                    {previewState === "ready" && (
                      <span
                        className="inline-flex items-center gap-1.5 text-success-ink"
                        role="status"
                        aria-live="polite"
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        پیش‌نمایش آماده است.
                      </span>
                    )}
                  </div>

                  {previewState === "error" && (
                    <Notice tone="warning" className="mt-3 items-start">
                      مرورگر نتوانست این فایل را برای پیش‌نمایش بارگذاری کند. ممکن است آدرس موقت، محدود به شبکه خاص، یا ناسازگار با فرمت‌های این مرورگر باشد. در صورت اطمینان از آدرس می‌توانید آن را ذخیره کنید.
                    </Notice>
                  )}
                </div>
              ) : (
                <div className="mt-3 rounded-panel border border-dashed border-border-subtle bg-canvas p-5 text-center text-sm text-content-muted">
                  {normalizedUrl
                    ? "برای پیش‌نمایش، ابتدا آدرس معتبر HTTP(S) وارد کنید."
                    : "هنوز فایل صوتی انتخاب نشده است."}
                </div>
              )}
            </section>

            <Notice tone="info" className="items-start">
              مرورگرها معمولاً پخش خودکار صدا را تا اولین تعامل کاربر محدود می‌کنند. کنترل بی‌صدا کردن صدا در اجرای زنده همچنان در اختیار کاربر باقی می‌ماند.
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
                تغییرات صدای ذخیره‌نشده دارید.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-success-ink">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                تنظیمات صدا ذخیره شده است.
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
              disabled={
                !dirty ||
                saving ||
                conflictPending ||
                issues.length > 0
              }
              aria-busy={saving || undefined}
              onClick={() => void handleSave()}
            >
              {saving ? "در حال ذخیره…" : "ذخیره صدا"}
            </Button>
          </div>
        </footer>
      </aside>

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
            : "تغییرات صدا کنار گذاشته شود؟"
        }
        description={
          confirmState.kind === "reload-conflict"
            ? "تنظیمات ذخیره‌شده روی سرور جایگزین draft فعلی می‌شود و تغییرات صدای محلی از بین می‌رود."
            : "تغییرات ذخیره‌نشده صدای ارائه از بین می‌رود."
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
