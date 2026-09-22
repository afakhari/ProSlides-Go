import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  Palette,
  Trash2,
  X,
} from "lucide-react";

import { ApiError } from "../../../../shared/api/http.ts";
import { presentationTheme } from "../../../../shared/styles/presentationTheme.ts";
import Notice, {
  type NoticeTone,
} from "../../../../shared/ui/Notice.tsx";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import type { EditorPresentation } from "../../model/editor.ts";
import {
  DESIGN_LIMITS,
  designDraftToUpdate,
  validateDesignDraft,
} from "../model/designDraft.ts";
import { useRequiredDesignDraft } from "../model/useDesignDraftContext.ts";
import ImageUrlDialog from "./ImageUrlDialog.tsx";

type DesignInspectorProps = {
  quizId: string;
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

const BACKGROUND_PRESETS = [
  { label: "سفید", value: "#ffffff" },
  { label: "خاکستری روشن", value: "#f3f4f6" },
  { label: "آبی روشن", value: "#eff6ff" },
  { label: "نعنایی", value: "#f0fdf4" },
  { label: "یاسی", value: "#f5f3ff" },
  { label: "سرمه‌ای", value: "#312e81" },
] as const;

const TEXT_PRESETS = [
  { label: "تیره", value: "#0f172a" },
  { label: "روشن", value: "#ffffff" },
] as const;

export default function DesignInspector({
  quizId,
  onClose,
  onQuizUpdated,
  onDirtyChange,
  onNotify,
  onConflict,
}: DesignInspectorProps) {
  const {
    draft,
    dirty,
    reset,
    markSaved,
    setBackgroundColor,
    setBackgroundImageUrl,
    setTextColor,
  } = useRequiredDesignDraft();

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [conflictPending, setConflictPending] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    kind: "closed",
  });

  const issues = useMemo(
    () => validateDesignDraft(draft),
    [draft],
  );

  const theme = useMemo(
    () =>
      presentationTheme({
        background: {
          color: draft.backgroundColor,
          image: draft.backgroundImageUrl,
          text_color: draft.textColor,
        },
        text_color: draft.textColor,
      }),
    [
      draft.backgroundColor,
      draft.backgroundImageUrl,
      draft.textColor,
    ],
  );

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    setConflictPending(false);
  }, [draft.presentationId, draft.revision]);

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
      const update = designDraftToUpdate(draft);
      const saved = await quizService.updateQuizBackground(
        quizId,
        update,
        draft.revision,
      );

      markSaved(saved);
      onQuizUpdated(saved);
      onDirtyChange?.(false);
      setLastSavedAt(new Date());
      notify("طراحی ارائه ذخیره شد.", "success");
    } catch (error) {
      if (error instanceof ApiError && error.code === "edit_conflict") {
        setConflictPending(true);
        notify(
          "نسخه جدیدتری از طراحی ارائه روی سرور وجود دارد. تغییرات محلی شما حفظ شده است.",
          "warning",
        );
      } else if (error instanceof TypeError) {
        notify(
          "ارتباط با سرور برقرار نشد. تغییرات طراحی شما حفظ شده است.",
          "error",
        );
      } else {
        notify(
          "ذخیره طراحی ارائه انجام نشد. تغییرات شما حفظ شده است.",
          "error",
        );
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

  const saveState = saving ? "saving" : dirty ? "dirty" : "saved";

  return (
    <>
      <aside
        className="flex h-full min-h-0 flex-col bg-surface text-content"
        aria-label="تنظیمات طراحی ارائه"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-1 pb-4">
          <div>
            <h2 className="text-base font-bold">طراحی ارائه</h2>
            <p className="mt-1 text-xs leading-5 text-content-muted">
              پس‌زمینه و رنگ متن در همه اسلایدها و اجرای زنده استفاده می‌شود.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={saving}
            aria-label="بستن تنظیمات طراحی"
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
              طراحی ارائه جای دیگری تغییر کرده است. ذخیره دوباره تا تعیین تکلیف
              تعارض غیرفعال می‌ماند.
            </Notice>
          )}

          <div className="space-y-7">
            <section aria-labelledby="design-background-heading">
              <div>
                <h3
                  id="design-background-heading"
                  className="text-sm font-semibold"
                >
                  رنگ پایه پس‌زمینه
                </h3>
                <p className="mt-1 text-xs leading-5 text-content-muted">
                  این رنگ هنگام نبودن تصویر و همچنین برای محاسبه کنتراست متن استفاده می‌شود.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-pressed={
                      draft.backgroundColor === preset.value
                    }
                    disabled={saving || conflictPending}
                    onClick={() =>
                      setBackgroundColor(preset.value)
                    }
                    className="rounded-panel border border-border-subtle bg-surface p-2 text-start transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-pressed:border-brand aria-pressed:ring-2 aria-pressed:ring-focus/30 disabled:opacity-60"
                  >
                    <span
                      className="block h-10 w-full rounded-control border border-border-subtle"
                      style={{ backgroundColor: preset.value }}
                      aria-hidden="true"
                    />
                    <span className="mt-1.5 block text-xs font-bold">
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>

              <label
                htmlFor="design-background-custom"
                className="mt-3 flex items-center justify-between gap-3 rounded-panel border border-border-subtle bg-canvas p-3"
              >
                <span>
                  <span className="block text-sm font-medium">
                    رنگ سفارشی
                  </span>
                  <span
                    dir="ltr"
                    className="mt-1 block font-mono text-xs text-content-muted"
                  >
                    {draft.backgroundColor}
                  </span>
                </span>
                <input
                  id="design-background-custom"
                  type="color"
                  value={draft.backgroundColor}
                  disabled={saving || conflictPending}
                  onChange={(event) =>
                    setBackgroundColor(event.target.value)
                  }
                  className="h-10 w-14 cursor-pointer rounded-control border border-border-subtle bg-surface p-1 disabled:cursor-not-allowed"
                />
              </label>
            </section>

            <section aria-labelledby="design-text-heading">
              <div>
                <h3
                  id="design-text-heading"
                  className="text-sm font-semibold"
                >
                  رنگ متن
                </h3>
                <p className="mt-1 text-xs leading-5 text-content-muted">
                  اگر انتخاب شما کنتراست کافی نداشته باشد، ویرایشگر آن را به
                  نزدیک‌ترین رنگ خوانا اصلاح می‌کند.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {TEXT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-pressed={draft.textColor === preset.value}
                    disabled={saving || conflictPending}
                    onClick={() => setTextColor(preset.value)}
                    className="flex items-center gap-2 rounded-panel border border-border-subtle bg-surface p-3 text-sm font-bold transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus aria-pressed:border-brand aria-pressed:ring-2 aria-pressed:ring-focus/30 disabled:opacity-60"
                  >
                    <span
                      className="size-6 rounded-full border border-border-subtle"
                      style={{ backgroundColor: preset.value }}
                      aria-hidden="true"
                    />
                    {preset.label}
                  </button>
                ))}
              </div>

              <label
                htmlFor="design-text-custom"
                className="mt-3 flex items-center justify-between gap-3 rounded-panel border border-border-subtle bg-canvas p-3"
              >
                <span>
                  <span className="block text-sm font-medium">
                    رنگ متن سفارشی
                  </span>
                  <span
                    dir="ltr"
                    className="mt-1 block font-mono text-xs text-content-muted"
                  >
                    {draft.textColor}
                  </span>
                </span>
                <input
                  id="design-text-custom"
                  type="color"
                  value={draft.textColor}
                  disabled={saving || conflictPending}
                  onChange={(event) =>
                    setTextColor(event.target.value)
                  }
                  className="h-10 w-14 cursor-pointer rounded-control border border-border-subtle bg-surface p-1 disabled:cursor-not-allowed"
                />
              </label>
            </section>

            <section aria-labelledby="design-image-heading">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    id="design-image-heading"
                    className="text-sm font-semibold"
                  >
                    تصویر پس‌زمینه
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-content-muted">
                    تصویر روی رنگ پایه قرار می‌گیرد؛ رنگ پایه به‌عنوان fallback حفظ می‌شود.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving || conflictPending}
                  onClick={() => setImageDialogOpen(true)}
                >
                  <ImageIcon aria-hidden="true" />
                  {draft.backgroundImageUrl
                    ? "تغییر تصویر"
                    : "افزودن تصویر"}
                </Button>
              </div>

              {draft.backgroundImageUrl && (
                <div className="mt-3 flex items-center gap-3 rounded-panel border border-border-subtle bg-canvas p-2">
                  <div
                    className="h-16 w-24 shrink-0 rounded-control border border-border-subtle bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${JSON.stringify(draft.backgroundImageUrl)})`,
                      backgroundColor: draft.backgroundColor,
                    }}
                    aria-label="پیش‌نمایش تصویر پس‌زمینه"
                    role="img"
                  />
                  <span
                    dir="ltr"
                    className="min-w-0 flex-1 truncate text-xs text-content-muted"
                  >
                    {draft.backgroundImageUrl}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-danger"
                    disabled={saving || conflictPending}
                    aria-label="حذف تصویر پس‌زمینه"
                    onClick={() => setBackgroundImageUrl("")}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              )}
            </section>

            <section aria-labelledby="design-preview-heading">
              <h3
                id="design-preview-heading"
                className="text-sm font-semibold"
              >
                نمونه طراحی
              </h3>
              <div
                className="mt-2 overflow-hidden rounded-panel border border-[color:var(--live-border)] bg-cover bg-center p-5 text-[color:var(--live-fg)] shadow-sm"
                style={theme.style}
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--live-muted)]">
                  <Palette className="size-4" aria-hidden="true" />
                  همان theme مورد استفاده در preview و اجرای زنده
                </div>
                <p className="mt-4 text-xl font-black">
                  عنوان نمونه ارائه
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--live-muted)]">
                  این متن برای بررسی خوانایی رنگ‌ها نمایش داده می‌شود.
                </p>
              </div>
            </section>

            <Notice tone="info" className="items-start">
              تغییر طراحی روی همه اسلایدها اعمال می‌شود. هنگام ویرایش، Canvas
              اصلی همین draft ذخیره‌نشده را نمایش می‌دهد.
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
                تغییرات طراحی ذخیره‌نشده دارید.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-success-ink">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                طراحی ذخیره شده است.
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
              {saving ? "در حال ذخیره…" : "ذخیره طراحی"}
            </Button>
          </div>
        </footer>
      </aside>

      <ImageUrlDialog
        open={imageDialogOpen}
        initialUrl={draft.backgroundImageUrl}
        title="تصویر پس‌زمینه ارائه"
        maxLength={DESIGN_LIMITS.imageUrl}
        onClose={() => setImageDialogOpen(false)}
        onConfirm={setBackgroundImageUrl}
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
            : "تغییرات طراحی کنار گذاشته شود؟"
        }
        description={
          confirmState.kind === "reload-conflict"
            ? "طراحی ذخیره‌شده روی سرور جایگزین draft فعلی می‌شود و تغییرات محلی از بین می‌رود."
            : "تغییرات ذخیره‌نشده طراحی از بین می‌رود."
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
