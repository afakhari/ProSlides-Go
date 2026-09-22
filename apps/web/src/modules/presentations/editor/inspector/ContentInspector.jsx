import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Save, X } from "lucide-react";

import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import { quizService } from "../../api/presentationRepository.ts";

const editableContent = (slide) => ({
  title: slide?.title || "",
  content_text: slide?.content_text || "",
  content_image_url: slide?.content_image_url || "",
});

export default function ContentSidebar({
  quizId,
  slide,
  onClose,
  onSlideUpdated,
  onDirtyChange,
  onNotify,
  onConflict,
}) {
  const [draft, setDraft] = useState(() => editableContent(slide));
  const [original, setOriginal] = useState(() => editableContent(slide));
  const [saving, setSaving] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);

  useEffect(() => {
    const value = editableContent(slide);
    setDraft(value);
    setOriginal(value);
  }, [slide]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(original), [draft, original]);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const notify = (message, tone = "error") => onNotify?.(message, tone);
  const close = () => {
    onDirtyChange?.(false);
    onClose(true);
  };

  const discard = () => {
    setDraft(original);
    setConfirmRevert(false);
    close();
  };

  const save = async () => {
    if (!dirty || saving) return;
    if (!String(draft.title || draft.content_text || draft.content_image_url).trim()) {
      notify("پیش از ذخیره اسلاید محتوا، عنوان، متن یا تصویر اضافه کنید.");
      return;
    }
    if (draft.content_image_url && !/^https?:\/\//i.test(draft.content_image_url)) {
      notify("پیوند تصویر باید با http:// یا https:// شروع شود.");
      return;
    }

    setSaving(true);
    try {
      const saved = await quizService.updateSlide(quizId, slide.slide_id, {
        ...slide,
        slide_type: 2,
        question: null,
        ...draft,
      });
      setOriginal(editableContent(saved));
      onSlideUpdated(saved);
      onDirtyChange?.(false);
      notify("اسلاید محتوا ذخیره شد.", "success");
      onClose(true);
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.error === "edit_conflict") {
        await onConflict?.();
        notify("این اسلاید در جایی دیگر تغییر کرد. آخرین نسخه بارگذاری شد.", "warning");
        close();
      } else if (error.response?.status === 409 && error.response?.data?.error === "slide_has_results") {
        notify("این اسلاید نتیجه زنده دارد و تا بازنشانی نتایج نمی‌توان آن را تبدیل کرد.", "warning");
      } else {
        notify("ذخیره اسلاید محتوا انجام نشد.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h3 className="font-semibold text-gray-900">اسلاید محتوا</h3>
          <p className={`mt-1 text-xs ${dirty ? "text-amber-600" : "text-emerald-600"}`}>
            {dirty ? "تغییرات ذخیره‌نشده" : "همه تغییرات ذخیره شد"}
          </p>
        </div>
        <button type="button" onClick={() => dirty ? setConfirmRevert(true) : close()} className="rounded-lg p-2 hover:bg-red-50" aria-label="بستن ویرایشگر محتوا">
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto py-5">
        <label className="block text-sm font-medium text-gray-700">
          عنوان
          <input
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            disabled={saving}
            maxLength={500}
            className="mt-2 w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="عنوان اسلاید محتوا"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          متن
          <textarea
            value={draft.content_text}
            onChange={(event) => setDraft((current) => ({ ...current, content_text: event.target.value }))}
            disabled={saving}
            maxLength={20000}
            rows={8}
            className="mt-2 w-full resize-y rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="اسلاید بعدی یا موضوع را برای سؤال بعدی توضیح دهید."
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          پیوند تصویر
          <input
            value={draft.content_image_url}
            onChange={(event) => setDraft((current) => ({ ...current, content_image_url: event.target.value.trim() }))}
            disabled={saving}
            maxLength={4096}
            inputMode="url"
            className="mt-2 w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
            placeholder="https://example.com/image.jpg"
          />
        </label>
      </div>

      <div className="sticky bottom-0 border-t border-gray-200 bg-white py-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 px-4 py-2.5 font-medium text-white hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {saving ? <Save className="h-4 w-4 animate-pulse" /> : dirty ? <Save className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? "در حال ذخیره…" : dirty ? "ذخیره محتوا" : "ذخیره شد"}
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmRevert}
        onClose={() => setConfirmRevert(false)}
        onConfirm={discard}
        title="بازگرداندن تغییرات؟"
        description="تغییرات ذخیره‌نشده محتوای شما از بین خواهد رفت."
        confirmText="رها کردن تغییرات"
        cancelText="ادامه ویرایش"
        confirmVariant="destructive"
        isLoading={false}
      />
    </div>
  );
}
