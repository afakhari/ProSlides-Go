import { useMemo } from "react";

import type { LivePresentationModel } from "../../model/presentation.ts";
import type {
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../../model/serverData.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";

type ParticipantActivityResultProps = {
  quiz: LivePresentationModel;
  question: LegacyQuestionSlide;
  result: LegacyQuestionResult | null;
};

export function ParticipantActivityResult({
  quiz,
  question,
  result,
}: ParticipantActivityResultProps) {
  const options = question.options ?? [];
  const counts = useMemo(() => {
    const byOption = new Map<string, number>();
    for (const row of result?.optionsResult ?? []) {
      byOption.set(
        String(row.option_id),
        Math.max(0, Number(row.number_of_submits ?? 0)),
      );
    }
    return byOption;
  }, [result?.optionsResult]);

  const totalResponses = Math.max(
    0,
    Number(result?.response_count ?? 0),
  );
  const hasCorrectAnswer = question.has_correct_answer !== false;

  return (
    <ParticipantShell quiz={quiz} connected showConnection>
      <section className="flex flex-1 flex-col py-3">
        <div className="flex flex-1 flex-col rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="text-center">
            <p className="text-sm font-bold text-[color:var(--live-muted)]">
              نتیجه فعالیت
            </p>
            <h1
              className="mt-2 text-2xl font-black leading-10 sm:text-3xl"
              dir="auto"
            >
              {question.question_text || "نتیجه"}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--live-muted)]">
              {totalResponses.toLocaleString("fa-IR")} پاسخ ثبت‌شده
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {options.map((option, index) => {
              const count = counts.get(String(option.option_id)) ?? 0;
              const correct = hasCorrectAnswer && option.answer === true;

              return (
                <article
                  key={String(option.option_id) + ":" + index}
                  className={
                    "rounded-2xl border-2 p-4 " +
                    (hasCorrectAnswer
                      ? correct
                        ? "border-success/70 bg-success/15"
                        : "border-[color:var(--live-border)] bg-white/5"
                      : "border-[color:var(--live-border)] bg-white/5")
                  }
                >
                  <div className="flex items-center gap-3">
                    {option.image_url ? (
                      <img
                        src={option.image_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 font-bold" dir="auto">
                      {option.option_text}
                    </span>
                    <strong className="shrink-0 text-lg">
                      {count.toLocaleString("fa-IR")}
                    </strong>
                  </div>
                  {correct ? (
                    <p className="mt-2 text-sm font-bold text-success">
                      پاسخ صحیح
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <p
            className="mt-auto pt-6 text-center text-sm text-[color:var(--live-muted)]"
            role="status"
          >
            در انتظار ادامه ارائه‌دهنده…
          </p>
        </div>
      </section>
    </ParticipantShell>
  );
}
