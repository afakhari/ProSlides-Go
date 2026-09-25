import { useMemo } from "react";

import type { LivePresentationModel } from "../../model/presentation.ts";
import type {
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../../model/serverData.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
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
  const { isConnected, snapshot } = useLiveSession();
  const participant =
    snapshot?.role === "participant" ? snapshot.participant : null;
  const personalResult =
    snapshot?.role === "participant" &&
    snapshot.personal_activity_result?.activity_item_id != null &&
    String(snapshot.personal_activity_result.activity_item_id) ===
      String(question.question_id)
      ? snapshot.personal_activity_result
      : null;

  const selectedIndexes = useMemo(() => {
    const response = personalResult?.response;
    return new Set(
      response && "selected_option_indexes" in response
        ? response.selected_option_indexes
        : [],
    );
  }, [personalResult?.response]);
  const personalText =
    personalResult?.response && "text" in personalResult.response
      ? personalResult.response.text
      : null;

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

  const wordTerms = result?.wordTerms ?? [];
  const maxTermCount = Math.max(
    1,
    ...wordTerms.map((term) => Math.max(0, Number(term.count))),
  );
  const totalResponses = Math.max(0, Number(result?.response_count ?? 0));
  const isWordCloud = question.activity_kind === "text";
  const hasCorrectAnswer = question.has_correct_answer !== false;
  const isPoll =
    !isWordCloud &&
    question.has_correct_answer === false &&
    question.is_scored === false;
  const hasScoring = snapshot?.role === "participant" && snapshot.has_scoring;
  const scoreDelta = Number(personalResult?.score_delta ?? 0);
  const totalScore = Number(participant?.score ?? 0);

  return (
    <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
      <section className="flex flex-1 flex-col py-3">
        <div className="flex flex-1 flex-col rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="text-center">
            <p className="text-sm font-bold text-[color:var(--live-muted)]">
              {isWordCloud
                ? "نتیجه ابر واژه"
                : isPoll
                  ? "نتیجه نظرسنجی"
                  : "نتیجه فعالیت"}
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

          {personalResult ? (
            <div
              className={
                "mx-auto mt-5 grid w-full max-w-xl gap-3 " +
                (hasScoring ? "grid-cols-2" : "grid-cols-1")
              }
              aria-label="نتیجه شخصی شما"
            >
              <div className="rounded-2xl border border-[color:var(--live-border)] bg-white/10 p-3 text-center">
                <p className="text-xs text-[color:var(--live-muted)]">
                  {isWordCloud
                    ? "پاسخ شما"
                    : question.is_scored === false
                      ? "وضعیت پاسخ"
                      : "امتیاز این فعالیت"}
                </p>
                <p className="mt-1 text-xl font-black" dir="auto">
                  {isWordCloud
                    ? personalText || "ثبت شد"
                    : question.is_scored === false
                      ? "ثبت شد"
                      : "+" + scoreDelta.toLocaleString("fa-IR")}
                </p>
              </div>
              {hasScoring ? (
                <div className="rounded-2xl border border-[color:var(--live-border)] bg-white/10 p-3 text-center">
                  <p className="text-xs text-[color:var(--live-muted)]">
                    امتیاز کل
                  </p>
                  <p className="mt-1 text-xl font-black">
                    {totalScore.toLocaleString("fa-IR")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p
              className="mx-auto mt-5 rounded-full border border-[color:var(--live-border)] bg-white/5 px-4 py-2 text-sm text-[color:var(--live-muted)]"
              role="status"
            >
              {isWordCloud
                ? "برای این ابر واژه پاسخی از شما ثبت نشده است."
                : isPoll
                  ? "برای این نظرسنجی پاسخی از شما ثبت نشده است."
                  : "برای این فعالیت پاسخی از شما ثبت نشده است."}
            </p>
          )}

          {isWordCloud ? (
            <div
              className="mt-6 flex min-h-52 flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-3xl border border-[color:var(--live-border)] bg-white/5 p-5"
              aria-label="ابر واژه نتیجه"
            >
              {wordTerms.length === 0 ? (
                <p className="text-sm text-[color:var(--live-muted)]">
                  هنوز واژه‌ای برای نمایش وجود ندارد.
                </p>
              ) : (
                wordTerms.map((term) => {
                  const ratio = Math.max(0.35, term.count / maxTermCount);
                  return (
                    <span
                      key={term.text}
                      dir="auto"
                      className="font-black leading-none"
                      style={{ fontSize: 16 + Math.round(ratio * 28) }}
                      aria-label={
                        term.text +
                        "، " +
                        term.count.toLocaleString("fa-IR") +
                        " بار"
                      }
                    >
                      {term.text}
                    </span>
                  );
                })
              )}
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {options.map((option, index) => {
                const count = counts.get(String(option.option_id)) ?? 0;
                const correct = hasCorrectAnswer && option.answer === true;
                const selected = selectedIndexes.has(index);

                return (
                  <article
                    key={String(option.option_id) + ":" + index}
                    className={
                      "rounded-2xl border-2 p-4 " +
                      (selected
                        ? "ring-2 ring-white/50 ring-offset-2 ring-offset-transparent "
                        : "") +
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
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold">
                      {selected ? (
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          انتخاب شما
                        </span>
                      ) : null}
                      {correct ? (
                        <span className="text-success">پاسخ صحیح</span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

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
