import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, LoaderCircle, X } from "lucide-react";

import { QUESTION_LIMITS } from "../../model/editor.ts";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";

type ImageUrlDialogProps = {
  open: boolean;
  initialUrl?: string;
  title: string;
  onClose: () => void;
  onConfirm: (url: string) => void;
};

const validateImageUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return "آدرس تصویر را وارد کنید.";
  if (Array.from(trimmed).length > QUESTION_LIMITS.imageUrl) {
    return "آدرس تصویر بیش از حد طولانی است.";
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "آدرس تصویر باید با http:// یا https:// شروع شود.";
    }
  } catch {
    return "آدرس تصویر معتبر نیست.";
  }

  return null;
};

export default function ImageUrlDialog({
  open,
  initialUrl = "",
  title,
  onClose,
  onConfirm,
}: ImageUrlDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewSequence = useRef(0);
  const [url, setUrl] = useState(initialUrl);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setUrl(initialUrl);
      setPreviewUrl("");
      setError("");
      setChecking(false);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [initialUrl, open]);

  useEffect(() => () => {
    previewSequence.current += 1;
  }, []);

  const close = () => {
    previewSequence.current += 1;
    setChecking(false);
    onClose();
  };

  const checkPreview = () => {
    const trimmed = url.trim();
    const validationError = validateImageUrl(trimmed);
    if (validationError) {
      setError(validationError);
      setPreviewUrl("");
      return;
    }

    const sequence = ++previewSequence.current;
    const image = new Image();
    let timeout = 0;

    setChecking(true);
    setError("");
    setPreviewUrl("");

    const finish = () => {
      if (timeout) window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };

    image.onload = () => {
      if (sequence !== previewSequence.current) return;
      finish();
      setChecking(false);
      setPreviewUrl(trimmed);
    };

    image.onerror = () => {
      if (sequence !== previewSequence.current) return;
      finish();
      setChecking(false);
      setError("تصویر از این آدرس بارگذاری نشد. آدرس دیگری را بررسی کنید.");
    };

    timeout = window.setTimeout(() => {
      if (sequence !== previewSequence.current) return;
      finish();
      setChecking(false);
      setError("بررسی تصویر بیش از حد طول کشید. دوباره تلاش کنید.");
    }, 8_000);

    image.src = trimmed;
  };

  const confirm = () => {
    const trimmed = url.trim();
    if (!previewUrl || previewUrl !== trimmed) {
      setError("پیش از ذخیره، پیش‌نمایش همین آدرس را بررسی کنید.");
      return;
    }
    onConfirm(trimmed);
    close();
  };

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      aria-labelledby="editor-image-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      className="m-auto w-[min(calc(100vw-2rem),34rem)] rounded-panel border border-border-subtle bg-surface-raised p-0 text-content shadow-panel backdrop:bg-content/35 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="editor-image-dialog-title" className="text-lg font-bold">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-content-muted">
              یک آدرس مستقیم HTTP یا HTTPS وارد کنید. تصویر قبل از ثبت بررسی می‌شود.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="بستن پنجره افزودن تصویر"
            onClick={close}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <label className="mt-5 block text-sm font-medium" htmlFor="editor-image-url">
          آدرس تصویر
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="editor-image-url"
            type="url"
            dir="ltr"
            inputMode="url"
            autoComplete="url"
            value={url}
            maxLength={QUESTION_LIMITS.imageUrl}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "editor-image-url-error" : "editor-image-url-help"}
            onChange={(event) => {
              setUrl(event.target.value);
              setPreviewUrl("");
              setError("");
            }}
            placeholder="https://example.com/image.jpg"
            className="h-10 min-w-0 flex-1 rounded-control border border-border-subtle bg-surface px-3 text-sm text-content outline-none transition focus:border-brand focus:ring-2 focus:ring-focus/30"
          />
          <Button
            variant="outline"
            onClick={checkPreview}
            disabled={checking || !url.trim()}
            aria-busy={checking || undefined}
          >
            {checking ? (
              <>
                <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                در حال بررسی…
              </>
            ) : (
              <>
                <ImageIcon aria-hidden="true" />
                بررسی تصویر
              </>
            )}
          </Button>
        </div>
        <p id="editor-image-url-help" className="mt-1 text-xs text-content-muted">
          برای پایداری ارائه، از آدرس دائمی و HTTPS استفاده کنید.
        </p>
        {error && (
          <p id="editor-image-url-error" role="alert" className="mt-2 text-sm text-danger-ink">
            {error}
          </p>
        )}

        {previewUrl && (
          <div className="mt-4 rounded-panel border border-border-subtle bg-canvas p-3">
            <p className="mb-2 text-xs font-semibold text-content-muted">پیش‌نمایش</p>
            <img
              src={previewUrl}
              alt="پیش‌نمایش تصویر انتخاب‌شده"
              className="h-52 w-full rounded-control bg-surface object-contain"
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={close}>
            انصراف
          </Button>
          <Button onClick={confirm} disabled={!previewUrl || checking}>
            استفاده از تصویر
          </Button>
        </div>
      </div>
    </dialog>
  );
}
