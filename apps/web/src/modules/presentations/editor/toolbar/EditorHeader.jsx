import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { quizService } from "../../api/presentationRepository.ts";
import ShareMenu from "../../sharing/ShareDialog";
import { fa } from "../../../../shared/i18n/fa";


export default function QuizHeader({
  accessCode = "ABC123",
  quizTitle = "", 
  quizId,
  quizRevision,
  onNotify,
  onBack,
  onQuizUpdated,
  onConflict,
  onAccessCodeSaved,
  saveState = "saved",
}) {

  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const saveStateLabel = saveState === "conflict"
    ? "تعارض ویرایش"
    : saveState === "dirty"
      ? "ذخیره‌نشده"
      : "ذخیره‌شده";


  // 
  useEffect(() => {
    setNewQuizTitle(quizTitle || "");
  }, [quizTitle]);


  const handleUpdateQuizName = async () => {
    if (!quizId) {
      onNotify?.("شناسه ارائه معتبر نیست.", "error");
      setIsEditing(false);
      return;
    }

    if (!newQuizTitle || typeof newQuizTitle !== "string") {
      onNotify?.("یک نام معتبر وارد کنید.", "error");
      return;
    }

    const trimmedTitle = newQuizTitle.trim();

    if (!trimmedTitle || trimmedTitle === quizTitle) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    onNotify?.("در حال ذخیره نام ارائه…", "info", true);
    try {
      const updatedQuiz = await quizService.updateQuiz(quizId, { title: trimmedTitle, revision: quizRevision });
      if (onQuizUpdated) onQuizUpdated(updatedQuiz);
      onNotify?.("نام ارائه ذخیره شد.", "success");
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.error === "edit_conflict") {
        if (onConflict) await onConflict();
        onNotify?.("این ارائه جای دیگری تغییر کرده است. آخرین نسخه بارگذاری شد.", "warning");
        return;
      }
      // Return to previous name
      setNewQuizTitle(quizTitle || "");

      // Display an error message to the user
      if (error.response) {
        onNotify?.(
          `خطای ذخیره: ${
            error.response.data?.message || "ذخیره نام انجام نشد."
          }`,
          "error"
        );
      } else if (error.request) {
        onNotify?.("ارتباط با سرور برقرار نشد.", "error");
      } else {
        onNotify?.("خطای پیش‌بینی‌نشده‌ای رخ داد.", "error");
      }
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };


  const handleCancelEdit = () => {
    setNewQuizTitle(quizTitle || "");
    setIsEditing(false);
  };


  // تابع handleInputChange برای اطمینان از مقدار معتبر
  const handleInputChange = (e) => {
    const value = e.target.value || "";
    setNewQuizTitle(value);
  };


  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 flex h-16 w-full items-center justify-between gap-2 border-b border-brand-border bg-surface/95 px-3 shadow-sm backdrop-blur md:px-5"
        dir="rtl"
        style={{ fontFamily: '"Vazirmatn", "Segoe UI", sans-serif' }}
      >
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button
            onClick={() => (onBack ? onBack() : navigate("/manager/panel"))}
            className="rounded-xl p-2 text-content-muted transition hover:bg-brand-soft hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            title="بازگشت به ارائه‌ها"
            aria-label="بازگشت به ارائه‌ها"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <div className="hidden items-center gap-1.5 font-brand text-base font-bold text-brand-ink before:text-xl before:text-brand before:content-['✱'] sm:flex" dir="ltr">
            ProSlides
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="max-w-[42vw] truncate rounded-xl px-3 py-2 text-sm font-bold text-content transition hover:bg-brand-soft hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:max-w-sm sm:px-4"
              title="تغییر نام ارائه"
              dir="auto"
            >
              {quizTitle || fa.editor.untitledPresentation}
            </button>
          ) : (
            // Quiz name editing space
            <div className="flex items-center gap-1 rounded-xl border border-brand-border bg-surface p-1 shadow-lg sm:gap-2 sm:px-2">
              <input
                type="text"
                value={newQuizTitle || ""} 
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateQuizName();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                autoFocus
                disabled={isUpdating}
                dir="auto"
                className="px-3 py-1 mb-1 mt-1 rounded-lg border border-gray-300
                        focus:outline-none focus:ring-2 focus:ring-focus
                        focus:border-transparent bg-white text-gray-800 w-28 sm:w-56"
                placeholder="نام ارائه"
              />

              <button
                onClick={handleUpdateQuizName}
                disabled={isUpdating || !newQuizTitle || !newQuizTitle.trim()}
                className="flex items-center justify-center w-8 h-8
                        bg-success hover:brightness-90 text-content-inverse
                        rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="ذخیره نام"
                aria-label="ذخیره نام"
              >
                {isUpdating ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <span className="text-lg">✓</span>
                )}
              </button>

              <button
                onClick={handleCancelEdit}
                disabled={isUpdating}
                className="flex items-center justify-center w-8 h-8 
                        bg-gray-300 hover:bg-gray-400 text-gray-700 
                        rounded-lg transition disabled:opacity-50"
                title="انصراف"
                aria-label="انصراف از تغییر نام"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>
          )}


          <span
            className={`hidden rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex ${
              saveState === "conflict"
                ? "bg-danger-soft text-danger"
                : saveState === "dirty"
                  ? "bg-warning-soft text-warning-ink"
                  : "bg-success-soft text-success"
            }`}
            role="status"
            aria-live="polite"
          >
            {saveStateLabel}
          </span>

          {/* --------------- Share Button --------------- */}
          <button
            onClick={() => setShowShareModal(true)}
            title={fa.editor.openShare}
            className="rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-content-inverse shadow-lg transition hover:bg-brand-strong active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
          >
            {fa.editor.share}
          </button>
        </div>
      </header>


      <ShareMenu
        quizId={quizId}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        accessCode={accessCode}
        onAccessCodeSaved={onAccessCodeSaved}
      />
    </>
  );
}
