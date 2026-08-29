import { useRef, useState, useEffect } from "react";
import { useLiveSession } from "../../../hooks/useLiveSession";
import { createRequestId } from "../../../live/liveApi";
import { useServerData } from "../../../hooks/useServerData";
import { ParticipantShell } from "../../../modules/live/participant/ParticipantShell";
import { resolveQuestionTimer } from "../utils/questionTimerSync";

const LEGACY_ANSWER_QUEUE_KEY = "presentation_answer_queue_v1";
const getAnswerQueueKey = (roomId) =>
  `presentation_answer_queue_v2:${String(roomId || "unknown")}`;

const getAnswerKey = (answer) =>
  `${answer.user_id}:${answer.question_id}:${answer.run_id ?? "na"}`;

const readQueuedAnswers = (roomId) => {
  try {
    const raw = localStorage.getItem(getAnswerQueueKey(roomId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueuedAnswers = (roomId, items) => {
  if (!Array.isArray(items) || items.length === 0) {
    localStorage.removeItem(getAnswerQueueKey(roomId));
    return;
  }
  localStorage.setItem(getAnswerQueueKey(roomId), JSON.stringify(items));
};

const queueAnswer = (roomId, answer) => {
  const key = getAnswerKey(answer);
  const current = readQueuedAnswers(roomId);
  const next = current.filter((item) => getAnswerKey(item) !== key);
  next.push(answer);
  writeQueuedAnswers(roomId, next);
};

const removeQueuedAnswer = (roomId, answer) => {
  const key = getAnswerKey(answer);
  const current = readQueuedAnswers(roomId);
  const next = current.filter((item) => getAnswerKey(item) !== key);
  writeQueuedAnswers(roomId, next);
};

const isSameQuestion = (queued, questionId, runId) => {
  if (queued?.question_id == null || questionId == null) return false;
  if (String(queued.question_id) !== String(questionId)) return false;
  if (runId == null) return true;
  return String(queued.run_id ?? "na") === String(runId);
};

const pruneQueuedAnswersForCurrentQuestion = (roomId, questionId, runId) => {
  const current = readQueuedAnswers(roomId);
  if (current.length === 0) return;
  const next = current.filter((item) => isSameQuestion(item, questionId, runId));
  writeQueuedAnswers(roomId, next);
};

const flushQueuedAnswers = async (roomId, submitAnswer, questionId, runId) => {
  const current = readQueuedAnswers(roomId);
  if (current.length === 0) {
    return { sentKeys: [], rejectedKeys: [], remaining: 0 };
  }

  const sentKeys = [];
  const rejectedKeys = [];
  const remaining = [];
  let socketFailed = false;

  for (const answer of current) {
    if (!isSameQuestion(answer, questionId, runId)) {
      remaining.push(answer);
      continue;
    }

    if (socketFailed) {
      remaining.push(answer);
      continue;
    }

    const outcome = await submitAnswer(answer);
    if (outcome === true) {
      sentKeys.push(getAnswerKey(answer));
    } else if (outcome === "rejected") {
      rejectedKeys.push(getAnswerKey(answer));
    } else {
      socketFailed = true;
      remaining.push(answer);
    }
  }

  writeQueuedAnswers(roomId, remaining);
  return { sentKeys, rejectedKeys, remaining: remaining.length };
};

export default function PlayerPickAnswerQuestion({
  roomId,
  question,
  result: propResult,
  quiz,
}) {
  const { questionResults, partialQuestionResults } = useServerData();
  const { submitAnswer, isConnected, connectionError } = useLiveSession();

  const questionId = question?.question_id;
  const questionTime = question?.question_time ?? 0;
  const runId =
    Number.isFinite(question?.run_id) || typeof question?.run_id === "number"
      ? question.run_id
      : null;

  const [selectedOptions, setSelectedOptions] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitState, setSubmitState] = useState("idle"); // idle | queued | sent | missing_id
  const [submitMessage, setSubmitMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(questionTime);
  const startTime = useRef(Date.now());
  const questionRef = useRef(question);
  questionRef.current = question;

  const matchQuestionResult = (candidate) => {
    if (!candidate || questionId == null || candidate.question_id == null) {
      return null;
    }
    return String(candidate.question_id) === String(questionId)
      ? candidate
      : null;
  };

  const result =
    matchQuestionResult(propResult) ||
    matchQuestionResult(questionResults) ||
    matchQuestionResult(partialQuestionResults);

  useEffect(() => {
    // Migration safety: drop old global queue to avoid stale cross-session answers.
    localStorage.removeItem(LEGACY_ANSWER_QUEUE_KEY);
  }, []);

  useEffect(() => {
    if (!roomId || questionId == null) return;
    pruneQueuedAnswersForCurrentQuestion(roomId, questionId, runId);
  }, [roomId, questionId, runId]);

  useEffect(() => {
    const currentQuestion = questionRef.current;
    if (!currentQuestion) return;
    const resolvedTimer = resolveQuestionTimer({
      question: currentQuestion,
      roomId,
      role: "player",
    });
    startTime.current = resolvedTimer.anchorStartMs;
    setTimeLeft(resolvedTimer.remainingSeconds);
    setSelectedOptions([]);
    setSubmitted(false);
    setSubmitState("idle");
    setSubmitMessage("");
  }, [roomId, questionId, runId]);

  useEffect(() => {
    if (!questionRef.current) return;
    let frameId;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const elapsed = (Date.now() - startTime.current) / 1000;
      const left = Math.max(0, questionTime - elapsed);
      setTimeLeft(left);
      if (left > 0) {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [roomId, questionId, runId, questionTime]);

  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;
    void flushQueuedAnswers(roomId, submitAnswer, questionId, runId).then(
      ({ sentKeys, rejectedKeys, remaining }) => {
        if (cancelled) return;
        const currentUserId = localStorage.getItem("user_id");
        const currentKeyPrefix = `${currentUserId}:${questionId}:`;
        if (currentUserId && rejectedKeys.some((key) => key.startsWith(currentKeyPrefix))) {
          setSubmitState("rejected");
          setSubmitMessage("زمان پاسخ‌گویی پایان یافته یا پاسخ توسط جلسه پذیرفته نشد.");
          return;
        }
        if (currentUserId && sentKeys.some((key) => key.startsWith(currentKeyPrefix))) {
          setSubmitState("sent");
          setSubmitMessage("پاسخ شما ارسال شد.");
          return;
        }
        if (remaining === 0 && submitState === "queued") {
          setSubmitState("sent");
          setSubmitMessage("پاسخ شما ارسال شد.");
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [isConnected, submitAnswer, roomId, questionId, runId, submitState]);

  const handleSelect = (option) => {
    if (submitted || timeLeft <= 0) return;

    if (question.has_multiple === false) {
      setSelectedOptions((prev) => (prev.includes(option) ? [] : [option]));
    } else {
      setSelectedOptions((prev) =>
        prev.includes(option)
          ? prev.filter((item) => item !== option)
          : [...prev, option]
      );
    }
  };

  const handleSubmit = async () => {
    if (!question) return;
    if (selectedOptions.length === 0) return;

    setSubmitted(true);

    const userId = localStorage.getItem("user_id");
    if (!userId) {
      setSubmitState("missing_id");
      setSubmitMessage("هویت بازیکن معتبر نیست. لطفا دوباره وارد بازی شوید.");
      return;
    }

    const elapsedSeconds = (Date.now() - startTime.current) / 1000;

    const options = question.options || [];
    const answer = {
      request_id: createRequestId(),
      question_id: question.question_id,
      user_id: userId,
      ...(runId != null ? { run_id: runId } : {}),
      submit_time: Math.round(elapsedSeconds * 1000) / 1000,
      options_result: options.map((opt) => ({
        option_id: opt.option_id,
        picked: selectedOptions.some((s) => s.option_id === opt.option_id),
      })),
    };

    const outcome = isConnected ? await submitAnswer(answer) : false;
    if (outcome === true) {
      removeQueuedAnswer(roomId, answer);
      setSubmitState("sent");
      setSubmitMessage("پاسخ شما ارسال شد.");
      return;
    }

    if (outcome === "rejected") {
      removeQueuedAnswer(roomId, answer);
      setSubmitState("rejected");
      setSubmitMessage("زمان پاسخ‌گویی پایان یافته یا پاسخ توسط جلسه پذیرفته نشد.");
      return;
    }

    queueAnswer(roomId, answer);
    setSubmitState("queued");
    setSubmitMessage("اتصال قطع است؛ پاسخ ذخیره شد و پس از اتصال ارسال می‌شود.");
  };

  useEffect(() => {
    if (timeLeft <= 0 && !submitted) {
      void handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const progressPercent =
    timeLeft >= 0 && questionTime > 0 ? (timeLeft / questionTime) * 100 : 0;
  const showResults = timeLeft <= 0 || !!result;
  const waitingForResults = timeLeft <= 0 && !result;
  const options = question?.options || [];

  if (!question) return null;

  return (
    <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
      <section className="flex flex-1 flex-col py-3">
        {connectionError && <p role="alert" className="mb-3 rounded-xl border border-amber-300/30 bg-amber-950/25 px-4 py-3 text-center text-sm">ارتباط ناپایدار است؛ پاسخ شما تا اتصال دوباره محفوظ می‌ماند.</p>}
        {waitingForResults && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 px-5 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-950/75 px-7 py-8 text-center text-white shadow-2xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/25 border-t-white" />
              <p className="mt-5 text-lg font-black">در حال آماده‌سازی نتیجه</p>
              <p className="mt-2 text-sm text-white/70">چند لحظه صبر کنید…</p>
            </div>
          </div>
        )}
        <div className="flex flex-1 flex-col rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-[color:var(--live-muted)]">
            <span>{question.has_multiple === false ? "یک گزینه را انتخاب کنید" : "می‌توانید چند گزینه انتخاب کنید"}</span>
            <span className="shrink-0 rounded-full bg-white/10 px-3 py-1" aria-label={`${Math.ceil(timeLeft)} ثانیه باقی مانده`}>{Math.ceil(timeLeft)} ثانیه</span>
          </div>
          <div className="my-4 h-2 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progressPercent)}>
            <div className="h-full rounded-full bg-white transition-transform duration-150" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
          </div>
          <h1 className="text-center text-2xl font-black leading-10 sm:text-3xl" dir="auto">{question.question_text}</h1>
          {question.image_url && (
            <img src={question.image_url} alt="تصویر سؤال" className="mx-auto my-4 max-h-44 max-w-full rounded-2xl border border-[color:var(--live-border)] object-contain shadow-lg" />
          )}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {options.map((goz) => {
                let optionClass = "border-[color:var(--live-border)] bg-white/10 hover:bg-white/15";
                let icon = null;

                if (showResults && result?.optionsResult) {
                  const foundOption = result.optionsResult.find(
                    (option) =>
                      String(option.option_id) === String(goz.option_id)
                  );

                  const hasCorrectness = typeof foundOption?.answer === "boolean";
                  const isCorrect = foundOption?.answer === true;

                  icon = hasCorrectness ? (isCorrect ? "درست" : "نادرست") : null;

                  if (selectedOptions.includes(goz) && submitted && hasCorrectness) {
                    optionClass = isCorrect
                      ? "border-emerald-300 bg-emerald-500/30"
                      : "border-rose-300 bg-rose-500/30";
                  }
                } else if (selectedOptions.includes(goz)) {
                  optionClass = "border-white bg-white/25 ring-2 ring-white/30";
                }

                return (
                  <button type="button"
                    key={goz.option_id}
                    aria-pressed={selectedOptions.includes(goz)}
                    disabled={submitted || timeLeft <= 0}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 p-3 text-start text-base font-bold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30 disabled:cursor-default ${optionClass}`}
                    onClick={() => handleSelect(goz)}
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-current text-xs">{selectedOptions.includes(goz) ? "✓" : ""}</span>
                    {goz.image_url && (
                      <img src={goz.image_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    )}
                    <span dir="auto">{goz.option_text}</span>
                    {icon && <span className="ms-auto text-xs">{icon}</span>}
                  </button>
                );
              })}
          </div>
          <div className="mt-auto pt-5">
            <button
              className="min-h-14 w-full rounded-2xl bg-white px-5 text-lg font-black text-slate-950 shadow-xl transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleSubmit}
              disabled={selectedOptions.length === 0 || timeLeft <= 0 || submitted}
            >
              {submitted ? "پاسخ ثبت شد" : "ثبت پاسخ"}
            </button>
            {submitted && (
              <p role="status" className="mt-3 text-center text-sm text-[color:var(--live-muted)]">{submitMessage || "پاسخ شما ثبت شد."}</p>
            )}
            {submitState === "missing_id" && <p role="alert" className="mt-2 text-center text-sm">هویت شرکت‌کننده معتبر نیست؛ دوباره وارد کوئیز شوید.</p>}
          </div>
        </div>
      </section>
    </ParticipantShell>
  );
}
