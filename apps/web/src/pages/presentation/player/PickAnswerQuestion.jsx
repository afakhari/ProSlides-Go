import { useRef, useState, useEffect } from "react";
import { useLiveSession } from "../../../hooks/useLiveSession";
import { createRequestId } from "../../../live/liveApi";
import { useServerData } from "../../../hooks/useServerData";
import { isLightColor } from "../../../lib/colorUtils";
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

  const backgroundStyle = {
    backgroundImage: quiz?.background?.image
      ? `url('${quiz.background.image}')`
      : "none",
    backgroundColor: quiz?.background?.color || "#1e1e2e",
  };
  const textColor =
    quiz?.text_color || quiz?.background?.text_color || "#111827";
  const textMutedColor =
    textColor.toLowerCase() === "#111827"
      ? "rgba(17, 24, 39, 0.7)"
      : "rgba(255, 255, 255, 0.7)";
  const needsOverlay =
    !!quiz?.background?.image ||
    isLightColor(quiz?.background?.color || "#1e1e2e");

  if (!question) return null;

  return (
    <div
      className="relative h-screen w-screen bg-cover bg-center bg-no-repeat font-poppins text-[color:var(--quiz-text)]"
      style={{
        ...backgroundStyle,
        "--quiz-text": textColor,
        "--quiz-text-muted": textMutedColor,
      }}
    >
      {needsOverlay && (
        <div className="pointer-events-none absolute inset-0 bg-black/45" />
      )}
      <div className="relative z-10 h-full w-full">
      <header>
        <div className="flex items-center justify-center text-[color:var(--quiz-text)] px-6 py-7 rounded-t-xl placeholder-gray-500">
          <div className="shrink-0">
            <p className="text-3xl">Proslides</p>
          </div>
        </div>
      </header>
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs text-[color:var(--quiz-text-muted)]">
        <span
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-green-400" : "bg-red-400"
          }`}
        ></span>
        <span aria-live="polite">{isConnected ? "متصل" : "قطع ارتباط"}</span>
      </div>
      {connectionError && (
        <div className="fixed top-12 right-4 z-40 rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">
          خطای اتصال
        </div>
      )}
      <div className="flex flex-col items-center justify-between">
        {waitingForResults && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/10 px-10 py-8 text-center shadow-2xl">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white"></div>
              <div className="text-lg font-semibold">در حال پردازش نتایج…</div>
              <div className="text-sm text-[color:var(--quiz-text-muted)]">
                لطفاً چند ثانیه صبر کنید
              </div>
            </div>
          </div>
        )}
        <div className="mx-4 mt-7 flex flex-col items-stretch m-auto">
          <div className=" text-3xl font-bold mb-2 text-center h-15">
            {question.question_text}
          </div>
          {question.image_url && (
            <div className="mb-4 flex justify-center">
              <img
                src={question.image_url}
                alt="Question"
                className="max-h-36 max-w-xs rounded-xl shadow-lg object-contain"
              />
            </div>
          )}
          <div className="min-h-auto max-w-2xl">
            <div className="m-2.5 flex flex-col items-stretch gap-[0.5vh]">
              <div className="flex items-center justify-between text-xl font-semibold text-[color:var(--quiz-text)] px-2 mt-3 opacity-90">
                <span>{question.min_point}p</span>
                <span className="text-sm text-[color:var(--quiz-text-muted)]">
                  {Math.ceil(timeLeft)}s
                </span>
                <span>{question.max_point}p</span>
              </div>

              <div className="border-2 border-[color:var(--quiz-text)] bg-[rgba(255,255,255,0.3)] h-2 rounded-[5px] mt-3 mb-5 overflow-hidden">
                <div
                  className="h-full bg-purple-600"
                  style={{
                    width: "100%",
                    transform: `scaleX(${Math.max(
                      0,
                      Math.min(1, progressPercent / 100)
                    )})`,
                    transformOrigin: "left",
                    transition: "transform 120ms linear",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    WebkitTransform: `scaleX(${Math.max(
                      0,
                      Math.min(1, progressPercent / 100)
                    )})`,
                    WebkitTransformOrigin: "left",
                  }}
                ></div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {options.map((goz) => {
                let optionClass = "";
                let icon = null;

                if (showResults && result?.optionsResult) {
                  const foundOption = result.optionsResult.find(
                    (option) =>
                      String(option.option_id) === String(goz.option_id)
                  );

                  const hasCorrectness = typeof foundOption?.answer === "boolean";
                  const isCorrect = foundOption?.answer === true;

                  icon = hasCorrectness ? (isCorrect ? "✅" : "❌") : null;

                  if (selectedOptions.includes(goz) && submitted && hasCorrectness) {
                    optionClass = isCorrect
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white";
                  }
                } else if (selectedOptions.includes(goz)) {
                  optionClass = "bg-[#6c2bd9]";
                }

                return (
                  <label
                    key={goz.option_id}
                    className={`bg-black/20 p-4 rounded-[10px] cursor-pointer 
                                  flex items-center gap-3
                                  text-[clamp(1rem,2.3vw,1.4rem)] 
                                  transition-all duration-300 
                                  mx-3 
                                  border-solid border-2 border-[color:var(--quiz-text)] hover:bg-black/30 ${optionClass}`}
                    onClick={() => handleSelect(goz)}
                  >
                    <span className="w-6 h-6 border-2 border-[color:var(--quiz-text)] rounded-full inline-flex shrink-0 items-center justify-center relative">
                      {selectedOptions.includes(goz) && !showResults && (
                        <span className="w-[22px] h-[22px] bg-[#393e3a] rounded-full"></span>
                      )}
                      {icon && (
                        <span className="text-sm text-[color:var(--quiz-text)] absolute">
                          {icon}
                        </span>
                      )}
                    </span>
                    {goz.image_url && (
                      <img
                        src={goz.image_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    )}
                    {goz.option_text}
                  </label>
                );
              })}
            </div>

            <button
              className="mt-[25px] mx-3 w-[calc(100%-20px)] p-4 border-none rounded-[10px]  font-bold cursor-pointer transition-all duration-300 text-2xl bg-white text-[#6c2bd9] disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={
                selectedOptions.length === 0 || timeLeft <= 0 || submitted
              }
            >
              {submitted ? "Submitted ✅" : "Submit"}
            </button>
            {submitted && (
              <div className="mt-3 text-center text-sm text-[color:var(--quiz-text-muted)]">
                {submitMessage || "پاسخ شما ثبت شد"}
              </div>
            )}
            {submitState === "missing_id" && (
              <div className="mt-2 text-center text-sm text-red-200">
                هویت بازیکن معتبر نیست. لطفا دوباره وارد بازی شوید.
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
