import type {
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../../model/serverData.ts";
import type { LivePresentationModel } from "../../model/presentation.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";
import { useParticipantAnswerController } from "../useParticipantAnswerController.ts";

type PlayerPickAnswerQuestionProps = {
  roomId?: string;
  question: LegacyQuestionSlide;
  result: LegacyQuestionResult | null;
  quiz: LivePresentationModel;
};

export function PlayerPickAnswerQuestion({
  roomId,
  question,
  result,
  quiz,
}: PlayerPickAnswerQuestionProps) {
  const { isConnected, connectionError } = useLiveSession();
  const controller = useParticipantAnswerController({
    roomId,
    question,
    result,
  });
  const options = question.options ?? [];

  return (
    <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
      <section className="flex flex-1 flex-col py-3">
        {connectionError ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-center text-sm"
          >
            ارتباط ناپایدار است؛ پاسخ ثبت‌شده تا اتصال دوباره محفوظ می‌ماند.
          </p>
        ) : null}

        {controller.waitingForResults ? (
          <div
            className="mb-3 rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-center text-sm"
            role="status"
            aria-live="polite"
          >
            زمان پاسخ‌گویی پایان یافته و جلسه در حال همگام‌سازی نتیجه است…
          </div>
        ) : null}

        <div className="flex flex-1 flex-col rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-[color:var(--live-muted)]">
            <span>
              {question.has_multiple === false
                ? "یک گزینه را انتخاب کنید"
                : "می‌توانید چند گزینه انتخاب کنید"}
            </span>
            <span
              className="shrink-0 rounded-full bg-white/10 px-3 py-1"
              role="timer"
              aria-label={`${Math.ceil(controller.timeLeft)} ثانیه باقی مانده`}
            >
              {Math.ceil(controller.timeLeft).toLocaleString("fa-IR")} ثانیه
            </span>
          </div>

          <div
            className="my-4 h-2 overflow-hidden rounded-full bg-black/20"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(controller.progressPercent)}
            aria-label="زمان باقی‌مانده"
          >
            <div
              className="h-full rounded-full bg-white transition-[width] duration-150"
              style={{ width: `${controller.progressPercent}%` }}
            />
          </div>

          <h1
            className="text-center text-2xl font-black leading-10 sm:text-3xl"
            dir="auto"
          >
            {question.question_text || question.question_title || "سؤال"}
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
              const selected = controller.isSelected(option, index);
              const resultOption = controller.result?.optionsResult?.find(
                (candidate) =>
                  String(candidate.option_id) ===
                  String(option.option_index ?? option.option_id ?? index),
              );
              const responseCount = Number(resultOption?.number_of_submits ?? 0);

              return (
                <button
                  type="button"
                  key={`${String(option.option_id)}:${index}`}
                  aria-pressed={selected}
                  disabled={controller.submitted || controller.timeLeft <= 0}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 p-3 text-start text-base font-bold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 disabled:cursor-default ${
                    selected
                      ? "border-white bg-white/25 ring-2 ring-white/30"
                      : "border-[color:var(--live-border)] bg-white/10 hover:bg-white/15"
                  }`}
                  onClick={() => controller.toggleOption(option, index)}
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
                  <span className="min-w-0 flex-1" dir="auto">
                    {option.option_text}
                  </span>
                  {controller.showResults ? (
                    <span className="ms-auto shrink-0 text-xs text-[color:var(--live-muted)]">
                      {responseCount.toLocaleString("fa-IR")} پاسخ
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-5">
            <button
              type="button"
              onClick={() => void controller.submit()}
              disabled={!controller.canSubmit}
              className="min-h-14 w-full rounded-2xl bg-white px-5 text-lg font-black text-slate-950 shadow-xl transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {controller.submitStatus === "sending"
                ? "در حال ارسال…"
                : controller.submitted
                  ? "پاسخ ثبت شد"
                  : "ثبت پاسخ"}
            </button>

            {controller.submitMessage ? (
              <p
                role={
                  controller.submitStatus === "rejected" ||
                  controller.submitStatus === "missing_identity"
                    ? "alert"
                    : "status"
                }
                className="mt-3 text-center text-sm text-[color:var(--live-muted)]"
              >
                {controller.submitMessage}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </ParticipantShell>
  );
}
