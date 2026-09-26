import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyQuestionSlide } from "../../model/serverData.ts";
import { isMultipleChoiceQuestion } from "../answerAttempt.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";
import { useParticipantAnswerController } from "../useParticipantAnswerController.ts";

type ParticipantQuestionProps = {
  roomId?: string;
  question: LegacyQuestionSlide;
  quiz: LivePresentationModel;
};

export function ParticipantQuestion({
  roomId,
  question,
  quiz,
}: ParticipantQuestionProps) {
  const controller = useParticipantAnswerController({ roomId, question });
  const options = question.options ?? [];
  const multiple = isMultipleChoiceQuestion(question);
  const timedOut = controller.timeLeft <= 0;
  const urgent = controller.timeLeft > 0 && controller.timeLeft <= 10;
  const selectedCount = controller.selectedIndexes.length;

  return (
    <ParticipantShell
      quiz={quiz}
      connected={controller.isStreamConnected}
      showConnection
    >
      <section className="flex flex-1 flex-col py-3">
        {controller.connectionError ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-amber-300/30 bg-amber-950/25 px-4 py-3 text-center text-sm"
          >
            ارتباط زنده ناپایدار است؛ انتخاب شما روی این دستگاه حفظ می‌شود و ارسال پاسخ همچنان قابل تلاش است.
          </p>
        ) : null}

        <div className="flex flex-1 flex-col rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-[color:var(--live-muted)]">
            <span>
              {multiple
                ? selectedCount > 0
                  ? selectedCount.toLocaleString("fa-IR") + " گزینه انتخاب شده"
                  : "می‌توانید چند گزینه انتخاب کنید"
                : selectedCount > 0
                  ? "گزینه شما انتخاب شده است"
                  : "یک گزینه را انتخاب کنید"}
            </span>
            <span
              className={
                "shrink-0 rounded-full border px-3 py-1 " +
                (urgent
                  ? "border-warning/50 bg-warning/15 text-white"
                  : "border-transparent bg-white/10")
              }
              role="timer"
              aria-live="off"
              aria-label={
                Math.ceil(controller.timeLeft).toLocaleString("fa-IR") +
                " ثانیه باقی مانده"
              }
            >
              {Math.ceil(controller.timeLeft).toLocaleString("fa-IR")} ثانیه
            </span>
          </div>

          <div
            className="my-4 h-2 overflow-hidden rounded-full bg-black/20"
            role="progressbar"
            aria-label="زمان باقی‌مانده"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(controller.progressPercent)}
          >
            <div
              className="h-full rounded-full bg-white transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: controller.progressPercent + "%" }}
            />
          </div>

          <h1
            className="text-center text-2xl font-black leading-10 sm:text-3xl"
            dir="auto"
          >
            {question.question_text || "سؤال"}
          </h1>

          {question.image_url ? (
            <img
              src={question.image_url}
              alt="تصویر سؤال"
              className="mx-auto my-4 max-h-44 max-w-full rounded-2xl border border-[color:var(--live-border)] object-contain shadow-lg"
            />
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => {
              const selected = controller.selectedIndexes.includes(index);
              return (
                <button
                  type="button"
                  key={String(option.option_id) + ":" + index}
                  aria-pressed={selected}
                  disabled={controller.isLocked || timedOut}
                  className={
                    "flex min-h-16 items-center gap-3 rounded-2xl border-2 p-3 text-start text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 disabled:cursor-default " +
                    (selected
                      ? "border-white bg-white/25 ring-2 ring-white/30"
                      : "border-[color:var(--live-border)] bg-white/10 hover:bg-white/15")
                  }
                  onClick={() => controller.toggleOption(index)}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-current text-xs">
                    {selected ? "✓" : ""}
                  </span>
                  {option.image_url ? (
                    <img
                      src={option.image_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : null}
                  <span dir="auto">{option.option_text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-5">
            {controller.submitState === "sent" ? (
              <div
                className="rounded-2xl border border-success/40 bg-success/15 px-5 py-4 text-center"
                role="status"
                aria-live="polite"
              >
                <p className="text-lg font-black">پاسخ ثبت شد ✓</p>
                <p className="mt-1 text-sm text-[color:var(--live-muted)]">
                  انتخاب شما ذخیره شده است. منتظر نمایش نتیجه بمانید.
                </p>
              </div>
            ) : controller.submitState === "retryable" &&
              controller.timeLeft > 0 ? (
              <button
                type="button"
                onClick={() => void controller.retry()}
                className="min-h-14 w-full rounded-2xl bg-white px-5 text-base font-black text-slate-950 shadow-xl transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 motion-reduce:transform-none"
              >
                تلاش دوباره برای ارسال
              </button>
            ) : (
              <button
                type="button"
                className="min-h-14 w-full rounded-2xl bg-white px-5 text-lg font-black text-slate-950 shadow-xl transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 motion-reduce:transform-none"
                onClick={() => void controller.submit()}
                disabled={!controller.canSubmit}
              >
                {controller.submitState === "sending"
                  ? "در حال ارسال…"
                  : timedOut
                    ? "زمان پایان یافت"
                    : "ثبت پاسخ"}
              </button>
            )}

            {controller.submitMessage && controller.submitState !== "sent" ? (
              <p
                role={
                  controller.submitState === "rejected" ? "alert" : "status"
                }
                className="mt-3 text-center text-sm text-[color:var(--live-muted)]"
              >
                {controller.submitMessage}
              </p>
            ) : null}

            {timedOut && controller.submitState !== "sent" ? (
              <p
                role="status"
                className="mt-3 text-center text-sm text-[color:var(--live-muted)]"
              >
                در انتظار ادامهٔ ارائه‌دهنده…
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </ParticipantShell>
  );
}
