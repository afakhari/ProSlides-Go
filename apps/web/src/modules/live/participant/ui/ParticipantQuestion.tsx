import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyQuestionSlide } from "../../model/serverData.ts";
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
  const multiple = question.has_multiple !== false;
  const timedOut = controller.timeLeft <= 0;

  return (
    <ParticipantShell
      quiz={quiz}
      connected={controller.isConnected}
      showConnection
    >
      <section className="flex flex-1 flex-col py-3">
        {controller.connectionError ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-amber-300/30 bg-amber-950/25 px-4 py-3 text-center text-sm"
          >
            ارتباط ناپایدار است. انتخاب فعلی شما روی همین صفحه حفظ می‌شود.
          </p>
        ) : null}

        <div className="flex flex-1 flex-col rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-[color:var(--live-muted)]">
            <span>
              {multiple
                ? "می‌توانید چند گزینه انتخاب کنید"
                : "یک گزینه را انتخاب کنید"}
            </span>
            <span
              className="shrink-0 rounded-full bg-white/10 px-3 py-1"
              role="timer"
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
            {controller.submitState === "retryable" &&
            controller.timeLeft > 0 ? (
              <button
                type="button"
                onClick={() => void controller.retry()}
                disabled={!controller.isConnected}
                className="min-h-14 w-full rounded-2xl bg-white px-5 text-base font-black text-slate-950 shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                تلاش دوباره برای ارسال
              </button>
            ) : (
              <button
                type="button"
                className="min-h-14 w-full rounded-2xl bg-white px-5 text-lg font-black text-slate-950 shadow-xl transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none"
                onClick={() => void controller.submit()}
                disabled={!controller.canSubmit}
              >
                {controller.submitState === "sending"
                  ? "در حال ارسال…"
                  : controller.submitState === "sent"
                    ? "پاسخ ثبت شد"
                    : timedOut
                      ? "زمان پایان یافت"
                      : "ثبت پاسخ"}
              </button>
            )}

            {controller.submitMessage ? (
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
