import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { X, Check, Loader2 } from "lucide-react";
import { quizService } from "../services/quizService.ts";
import Notice from "../shared/ui/Notice";


export default function ShareMenu({
  isOpen,
  onClose,
  accessCode,
  onAccessCodeSaved,
  quizId,
}) {

  const [section, setSection] = useState("invite");
  const [code, setCode] = useState(accessCode || "");
  const [initialCode, setInitialCode] = useState(accessCode || "");
  const [qr, setQr] = useState("");
  const [inputError, setInputError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);

  const baseOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://proslides.ir";
  const BASE = `${baseOrigin}/`;


  // Checking the validity of the code
  const validateCode = (input) => {
    if (!input) {
      return "";
    }
    if (input.length < 5) {
      return "کد ورود باید حداقل ۵ نویسه باشد.";
    }
    if (input.length > 12) {
      return "کد ورود باید حداکثر ۱۲ نویسه باشد.";
    }
    if (!/^[A-Za-z0-9]*$/.test(input)) {
      return "فقط حروف انگلیسی و عدد مجاز است.";
    }
    return "";
  };


  // Save code in the backend
  const saveAccessCode = async () => {
    if (!code || inputError || code.length < 5) return false;

    if (!quizId) {
      setSaveError("این ارائه در دسترس نیست.");
      return false;
    }
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const result = await quizService.setAccessCode(quizId, code);
      const updatedCode = result.access_code;
      setCode(updatedCode);
      setInitialCode(updatedCode);
      setSaveSuccess(true);
      if (onAccessCodeSaved) {
        onAccessCodeSaved(updatedCode);
      }

      // Delete success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

      return true;
    } catch (error) {
      if (error?.response?.status === 409) {
        setSaveError("این کد ورود قبلاً استفاده شده است.");
      } else {
        setSaveError("ذخیره کد ورود انجام نشد. دوباره تلاش کنید.");
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = code !== initialCode;

  const handleSave = async () => {
    if (!isCodeValid || isSaving || !hasChanges) return;
    if (initialCode && !confirmingSave) {
      setConfirmingSave(true);
      return;
    }
    const saved = await saveAccessCode();
    if (saved) {
      setConfirmingSave(false);
    }
  };

  const handleConfirmSave = async () => {
    const saved = await saveAccessCode();
    if (saved) {
      setConfirmingSave(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmingSave(false);
  };

  const isCodeValid = code.length >= 5 && !inputError;

  const handleCodeChange = (nextCode) => {
    setCode(nextCode);
    setInputError(validateCode(nextCode));
    setSaveError("");
    setSaveSuccess(false);
    setConfirmingSave(false);
  };


  // Update code when accessCode prop changes
  useEffect(() => {
    if (accessCode) {
      setCode(accessCode);
      setInitialCode(accessCode);
      setInputError(validateCode(accessCode));
      setSaveError("");
      setSaveSuccess(false);
      setConfirmingSave(false);
    } else {
      setCode("");
      setInitialCode("");
      setInputError("");
      setSaveError("");
      setSaveSuccess(false);
      setConfirmingSave(false);
    }
  }, [accessCode]);


  // Generate QR Code
  useEffect(() => {
    if (!code || inputError || code.length < 5) {
      setQr("");
      return;
    }

    const full = BASE + code;
    QRCode.toDataURL(full, { margin: 2 })
      .then((url) => setQr(url))
      .catch((err) => console.error(err));
  }, [BASE, code, inputError]);


  if (!isOpen) return null;


  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" dir="rtl">
        <div
          className="relative flex h-auto max-h-[90vh] w-[90vw] max-w-[900px] flex-col overflow-hidden rounded-panel bg-surface shadow-panel md:h-[500px] md:flex-row"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-dialog-title"
        >
          <button
            onClick={onClose}
            className="absolute end-5 top-5 z-10 rounded-control p-1 text-content-muted hover:bg-brand-soft hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="بستن پنجره اشتراک‌گذاری"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex w-full flex-col gap-3 border-b border-brand-border bg-brand-soft p-5 md:w-1/3 md:border-b-0 md:border-e">
            <h2 id="share-dialog-title" className="mb-2 text-lg font-semibold text-brand-strong">
              اشتراک‌گذاری ارائه
            </h2>
            <MenuItem
              label="دعوت از مخاطبان"
              active={section === "invite"}
              onClick={() => setSection("invite")}
            />
          </div>

          <div className="w-full md:w-2/3 p-6 overflow-y-auto">
            {section === "invite" && (
              <InviteAudienceUI
                BASE={BASE}
                code={code}
                onCodeChange={handleCodeChange}
                qr={qr}
                inputError={inputError}
                onSave={handleSave}
                onConfirmSave={handleConfirmSave}
                onCancelConfirm={handleCancelConfirm}
                onClose={onClose}
                isSaving={isSaving}
                saveError={saveError}
                saveSuccess={saveSuccess}
                hasChanges={hasChanges}
                confirmingSave={confirmingSave}
                isCodeValid={isCodeValid}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}


function MenuItem({ label, active, onClick }) {
  return (
    <button
      className={`w-full rounded-control px-3 py-2 text-start font-medium transition
        ${
          active
            ? "bg-brand-muted text-brand-strong"
            : "text-content-muted hover:bg-brand-muted"
        }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}


function InviteAudienceUI({
  BASE,
  code,
  onCodeChange,
  qr,
  inputError,
  onSave,
  onConfirmSave,
  onCancelConfirm,
  onClose,
  isSaving,
  saveError,
  saveSuccess,
  hasChanges,
  confirmingSave,
  isCodeValid
}) {

  const handleCodeChange = (e) => {
    const newCode = e.target.value.replace(/\s+/g, "");
    onCodeChange(newCode);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSave();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };


  // Checking the validity of the code to enable/disable the save button
  return (
    <div>
      <h2 className="mb-3 text-xl font-semibold text-content">
        دعوت از مخاطبان
      </h2>

      <p className="text-sm text-content-muted">مخاطبان از این نشانی وارد می‌شوند:</p>

      {/* --------------- Code Entry Section --------------- */}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
        <bdi className="text-content-muted" dir="ltr">{BASE}</bdi>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <input
            className={`w-full sm:w-[16ch] md:w-[18ch] flex-none rounded-control border px-3 py-2 text-sm focus:ring-2 focus:ring-focus ${
              inputError ? "border-danger" : "border-border-subtle"
            }`}
            placeholder="ROOM1"
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            maxLength={12}
            aria-describedby="access-code-help access-code-error"
            aria-invalid={Boolean(inputError)}
            dir="ltr"
          />
          <button
            onClick={onSave}
            disabled={!isCodeValid || !hasChanges || isSaving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              !isCodeValid || !hasChanges || isSaving
                ? "cursor-not-allowed bg-slate-100 text-slate-400"
                : "bg-brand text-content-inverse hover:bg-brand-strong"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال ذخیره…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                ذخیره
              </>
            )}
          </button>
        </div>
      </div>

      <p id="access-code-help" className="mt-2 text-xs text-content-muted">
        بین ۵ تا ۱۲ نویسه؛ فقط حروف انگلیسی و عدد.
      </p>


      {/* --------------- Display Validation Error Message --------------- */}
      {inputError && (
        <p id="access-code-error" className="mt-3 text-sm text-danger" role="alert">
          {inputError}
        </p>
      )}

      {isSaving && <Notice pending className="mt-3">در حال ذخیره کد ورود…</Notice>}

      {saveSuccess && (
        <Notice tone="success" className="mt-3">کد ورود ذخیره شد.</Notice>
      )}

      {saveError && (
        <Notice tone="error" className="mt-3">{saveError}</Notice>
      )}

      {confirmingSave && (
        <Notice tone="warning" className="mt-4 flex-col items-stretch">
          تغییر کد ورود، لینک قبلی را غیرفعال می‌کند. ادامه می‌دهید؟
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmSave}
              disabled={isSaving}
              className="rounded-control bg-warning px-3 py-1.5 text-xs font-semibold text-content-inverse hover:brightness-90 disabled:cursor-not-allowed"
            >
              تأیید و ذخیره
            </button>
            <button
              type="button"
              onClick={onCancelConfirm}
              className="rounded-control border border-warning-border px-3 py-1.5 text-xs font-semibold text-warning-ink hover:bg-warning-soft"
            >
              انصراف
            </button>
          </div>
        </Notice>
      )}

      {/* --------------- Display QR Code Only If The Code Is Valid And There Are No Errors --------------- */}
      {qr && !inputError && code.length >= 5 && (
        <div className="mt-6 flex flex-col items-center">
          <p className="mb-2 text-sm text-content-muted">کد QR را اسکن کنید</p>
          <img
            src={qr}
            alt="کد QR لینک ورود به ارائه"
            className="w-44 h-44 border rounded-xl shadow"
          />

          <a
            download="qr.png"
            href={qr}
            className="mt-3 rounded-control bg-brand px-4 py-1.5 text-sm text-content-inverse shadow transition hover:bg-brand-strong"
          >
            دریافت کد QR
          </a>
        </div>
      )}
    </div>
  );
}
