import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createRequestId } from "../api/liveApi.ts";
import type { LegacyQuestionSlide } from "../model/serverData.ts";
import { resolveQuestionTimer } from "../model/questionTimer.ts";
import { useLiveSession } from "../react/useLiveSession.ts";
import {
  clearPendingAnswer,
  readPendingAnswer,
  savePendingAnswer,
} from "./pendingAnswerStorage.ts";
import {
  buildParticipantAnswer,
  isMultipleChoiceQuestion,
  questionRunIdentity,
  toggleParticipantOption,
  type ParticipantSubmitState,
} from "./answerAttempt.ts";

type PendingAttempt = {
  identity: string;
  answer: NonNullable<ReturnType<typeof buildParticipantAnswer>>;
};

type ParticipantAnswerController = {
  selectedIndexes: number[];
  timeLeft: number;
  totalSeconds: number;
  progressPercent: number;
  submitState: ParticipantSubmitState;
  submitMessage: string;
  connectionError: string | null;
  isConnected: boolean;
  isStreamConnected: boolean;
  canSubmit: boolean;
  isLocked: boolean;
  toggleOption: (index: number) => void;
  submit: () => Promise<void>;
  retry: () => Promise<void>;
};

export function useParticipantAnswerController({
  roomId,
  question,
}: {
  roomId?: string;
  question: LegacyQuestionSlide;
}): ParticipantAnswerController {
  const {
    submitAnswer,
    isConnected,
    isStreamConnected,
    connectionError,
    snapshot,
  } = useLiveSession();
  const identity = questionRunIdentity(question);
  const timerScope = `${String(roomId ?? "unknown")}:${identity}`;
  const questionRef = useRef(question);
  questionRef.current = question;
  const activeIdentityRef = useRef(identity);
  activeIdentityRef.current = identity;

  const pendingRef = useRef<PendingAttempt | null>(null);
  const inFlightAttemptRef = useRef<string | null>(null);
  const wasConnectedRef = useRef(isConnected);
  const timerRef = useRef({ anchorStartMs: Date.now(), totalSeconds: 0 });
  const remainingRef = useRef(0);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [initializedTimerScope, setInitializedTimerScope] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [submitState, setSubmitState] =
    useState<ParticipantSubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    const current = questionRef.current;
    const resolved = resolveQuestionTimer({
      question: current,
      roomId,
      role: "player",
    });

    timerRef.current = {
      anchorStartMs: resolved.anchorStartMs,
      totalSeconds: resolved.totalSeconds,
    };
    remainingRef.current = resolved.remainingSeconds;
    setTimeLeft(resolved.remainingSeconds);
    setTotalSeconds(resolved.totalSeconds);
    setSelectedIndexes([]);
    const restoredAnswer = identity
      ? readPendingAnswer(roomId, identity)
      : null;
    pendingRef.current =
      identity && restoredAnswer
        ? { identity, answer: restoredAnswer }
        : null;
    setSubmitState(restoredAnswer ? "retryable" : "idle");
    setSubmitMessage(
      restoredAnswer
        ? "ارسال قبلی پس از تازه‌سازی در حال بازیابی است."
        : "",
    );
    inFlightAttemptRef.current = null;
    setInitializedTimerScope(timerScope);
  }, [identity, roomId, timerScope]);

  useEffect(() => {
    const alreadySubmitted =
      snapshot?.role === "participant" &&
      snapshot.has_responded &&
      String(snapshot.session.active_item_id ?? "") === identity;
    if (!alreadySubmitted) return;

    pendingRef.current = null;
    clearPendingAnswer(roomId, identity);
    inFlightAttemptRef.current = null;
    setSubmitState("sent");
    setSubmitMessage("پاسخ شما قبلاً ثبت شده است.");
  }, [identity, snapshot]);

  useEffect(() => {
    if (!identity || totalSeconds <= 0) return;

    let frame = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const elapsed = (Date.now() - timerRef.current.anchorStartMs) / 1000;
      const remaining = Math.max(
        0,
        timerRef.current.totalSeconds - elapsed,
      );
      remainingRef.current = remaining;
      setTimeLeft(remaining);
      if (remaining > 0) frame = window.requestAnimationFrame(tick);
    };

    tick();
    return () => {
      stopped = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [identity, totalSeconds]);

  useEffect(() => {
    if (initializedTimerScope !== timerScope || timeLeft > 0) return;
    if (
      submitState === "idle" ||
      submitState === "retryable"
    ) {
      pendingRef.current = null;
      setSubmitState("expired");
      setSubmitMessage(
        selectedIndexes.length > 0
          ? "زمان پاسخ‌گویی پایان یافت و پاسخ ارسال نشد."
          : "زمان پاسخ‌گویی پایان یافت.",
      );
    }
  }, [
    initializedTimerScope,
    selectedIndexes.length,
    submitState,
    timeLeft,
    timerScope,
  ]);

  const sendAttempt = useCallback(
    async (attempt: PendingAttempt) => {
      if (
        !identity ||
        attempt.identity !== identity ||
        activeIdentityRef.current !== attempt.identity ||
        remainingRef.current <= 0
      ) {
        pendingRef.current = null;
        clearPendingAnswer(roomId, attempt.identity);
        setSubmitState("expired");
        setSubmitMessage("زمان پاسخ‌گویی پایان یافت.");
        return;
      }

      const attemptKey = attempt.answer.request_id || attempt.identity;
      if (inFlightAttemptRef.current === attemptKey) return;
      if (inFlightAttemptRef.current !== null) return;

      inFlightAttemptRef.current = attemptKey;
      setSubmitState("sending");
      setSubmitMessage("در حال ارسال پاسخ…");

      try {
        const outcome = await submitAnswer(attempt.answer);

        if (activeIdentityRef.current !== attempt.identity) {
          return;
        }

        // Never expose a clickable terminal/retry state while this attempt is
        // still marked in flight. A fast retry click must not be discarded.
        if (inFlightAttemptRef.current === attemptKey) {
          inFlightAttemptRef.current = null;
        }

        if (outcome === true) {
          pendingRef.current = null;
          clearPendingAnswer(roomId, attempt.identity);
          setSubmitState("sent");
          setSubmitMessage("پاسخ شما ثبت شد.");
          return;
        }

        if (outcome === "rejected") {
          pendingRef.current = null;
          clearPendingAnswer(roomId, attempt.identity);
          setSubmitState("rejected");
          setSubmitMessage(
            "پاسخ پذیرفته نشد؛ احتمالاً زمان سؤال پایان یافته است.",
          );
          return;
        }

        pendingRef.current = attempt;
        setSubmitState("retryable");
        setSubmitMessage(
          "ارسال کامل نشد. انتخاب شما حفظ شده است؛ دوباره تلاش کنید.",
        );
      } finally {
        if (inFlightAttemptRef.current === attemptKey) {
          inFlightAttemptRef.current = null;
        }
      }
    },
    [identity, roomId, submitAnswer],
  );

  const submit = useCallback(async () => {
    if (
      !identity ||
      selectedIndexes.length === 0 ||
      remainingRef.current <= 0 ||
      ["sending", "sent", "rejected", "expired"].includes(submitState)
    ) {
      return;
    }

    const answer = buildParticipantAnswer({
      question: questionRef.current,
      selectedIndexes,
      requestId: createRequestId(),
    });
    if (!answer) return;

    const attempt = { identity, answer };
    pendingRef.current = attempt;
    savePendingAnswer(roomId, identity, answer);
    await sendAttempt(attempt);
  }, [identity, roomId, selectedIndexes, sendAttempt, submitState]);

  const retry = useCallback(async () => {
    const attempt = pendingRef.current;
    if (!attempt) return;
    await sendAttempt(attempt);
  }, [sendAttempt]);

  useEffect(() => {
    const reconnected = !wasConnectedRef.current && isConnected;
    wasConnectedRef.current = isConnected;
    if (!reconnected || submitState !== "retryable") return;

    const attempt = pendingRef.current;
    if (!attempt || attempt.identity !== identity) return;
    void sendAttempt(attempt);
  }, [identity, isConnected, sendAttempt, submitState]);

  const multiple = isMultipleChoiceQuestion(question);
  const isLocked = ["sending", "sent", "rejected", "expired"].includes(
    submitState,
  );

  const toggleOption = useCallback(
    (index: number) => {
      if (isLocked || remainingRef.current <= 0) return;
      setSelectedIndexes((current) =>
        toggleParticipantOption(current, index, multiple),
      );
      if (submitState === "retryable") {
        pendingRef.current = null;
        if (identity) clearPendingAnswer(roomId, identity);
        setSubmitState("idle");
        setSubmitMessage("");
      }
    },
    [identity, isLocked, multiple, roomId, submitState],
  );

  const progressPercent = useMemo(
    () =>
      totalSeconds > 0
        ? Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100))
        : 0,
    [timeLeft, totalSeconds],
  );

  return {
    selectedIndexes,
    timeLeft,
    totalSeconds,
    progressPercent,
    submitState,
    submitMessage,
    connectionError,
    isConnected,
    isStreamConnected,
    canSubmit:
      selectedIndexes.length > 0 &&
      timeLeft > 0 &&
      !["sending", "sent", "rejected", "expired"].includes(submitState),
    isLocked,
    toggleOption,
    submit,
    retry,
  };
}
