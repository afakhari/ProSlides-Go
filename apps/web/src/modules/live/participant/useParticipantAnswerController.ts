import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createRequestId } from "../api/liveApi.ts";
import {
  getPersistedUserIdForRoom,
} from "../model/playerProfileStorage.ts";
import {
  matchingQuestionResult,
} from "../model/presentationFlow.ts";
import { resolveQuestionTimer } from "../model/questionTimer.ts";
import type {
  LegacyQuestionOption,
  LegacyQuestionResult,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import { useLiveSession } from "../react/useLiveSession.ts";
import { useServerData } from "../react/useServerData.ts";
import {
  clearLegacyParticipantAnswerQueue,
  flushQueuedParticipantAnswers,
  pruneQueuedParticipantAnswers,
  queueParticipantAnswer,
  readQueuedParticipantAnswers,
  removeQueuedParticipantAnswer,
  type QueuedParticipantAnswer,
} from "./answerQueue.ts";
import {
  readParticipantAnswerReceipt,
  writeParticipantAnswerReceipt,
  type ParticipantAnswerStatus,
} from "./answerReceipt.ts";

type SubmitStatus =
  | "idle"
  | "sending"
  | ParticipantAnswerStatus
  | "missing_identity"
  | "expired";

type UseParticipantAnswerControllerOptions = {
  roomId?: string;
  question: LegacyQuestionSlide;
  result?: LegacyQuestionResult | null;
};

export type ParticipantAnswerController = {
  selectedIndexes: number[];
  submitted: boolean;
  submitStatus: SubmitStatus;
  submitMessage: string;
  timeLeft: number;
  progressPercent: number;
  result: LegacyQuestionResult | null;
  waitingForResults: boolean;
  showResults: boolean;
  canSubmit: boolean;
  isSelected: (option: LegacyQuestionOption, fallbackIndex: number) => boolean;
  toggleOption: (option: LegacyQuestionOption, fallbackIndex: number) => void;
  submit: () => Promise<void>;
};

const normalizeRunId = (
  value: LegacyQuestionSlide["run_id"],
): string | number | null =>
  typeof value === "string" || typeof value === "number" ? value : null;

export const participantOptionIndex = (
  option: LegacyQuestionOption,
  fallbackIndex: number,
): number => {
  const candidate = Number(option.option_index ?? option.option_id);
  return Number.isInteger(candidate) && candidate >= 0
    ? candidate
    : fallbackIndex;
};

export function useParticipantAnswerController({
  roomId,
  question,
  result: propResult = null,
}: UseParticipantAnswerControllerOptions): ParticipantAnswerController {
  const { questionResults, partialQuestionResults } = useServerData();
  const { submitAnswer, isConnected } = useLiveSession();

  const questionId = question.question_id;
  const runId = normalizeRunId(question.run_id);
  const identity = `${String(roomId ?? "unknown")}:${String(
    questionId ?? "unknown",
  )}:${String(runId ?? "na")}`;
  const questionRef = useRef(question);
  questionRef.current = question;

  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const timerAnchorRef = useRef(Date.now());
  const timerTotalRef = useRef(0);
  const submitInFlightRef = useRef(false);

  const result = useMemo(
    () =>
      matchingQuestionResult(
        question,
        propResult,
        questionResults,
        partialQuestionResults,
      ),
    [partialQuestionResults, propResult, question, questionResults],
  );

  useEffect(() => {
    clearLegacyParticipantAnswerQueue();
    const userId = getPersistedUserIdForRoom(roomId);
    pruneQueuedParticipantAnswers(roomId, questionId, runId, userId);

    const currentQuestion = questionRef.current;
    const timer = resolveQuestionTimer({
      question: currentQuestion,
      roomId,
      role: "player",
    });
    timerAnchorRef.current = timer.anchorStartMs;
    timerTotalRef.current = timer.totalSeconds;
    setTimeLeft(timer.remainingSeconds);

    const receipt = readParticipantAnswerReceipt(
      roomId,
      questionId,
      runId,
    );
    if (receipt) {
      setSelectedIndexes(receipt.selected_option_indexes);
      setSubmitted(receipt.status !== "rejected");
      setSubmitStatus(receipt.status);
      setSubmitMessage(
        receipt.status === "sent"
          ? "پاسخ شما ارسال شده است."
          : receipt.status === "queued"
            ? "پاسخ شما ذخیره شده و پس از بازیابی اتصال ارسال می‌شود."
            : "این پاسخ توسط جلسه پذیرفته نشد.",
      );
      return;
    }

    const queued = readQueuedParticipantAnswers(roomId).find(
      (answer) =>
        answer.user_id === userId &&
        String(answer.question_id) === String(questionId) &&
        (runId == null ||
          String(answer.run_id ?? "na") === String(runId)),
    );
    if (queued) {
      setSelectedIndexes(queued.selected_option_indexes);
      setSubmitted(true);
      setSubmitStatus("queued");
      setSubmitMessage(
        "پاسخ شما ذخیره شده و پس از بازیابی اتصال ارسال می‌شود.",
      );
      return;
    }

    setSelectedIndexes([]);
    setSubmitted(false);
    setSubmitStatus("idle");
    setSubmitMessage("");
  }, [identity, questionId, roomId, runId]);

  useEffect(() => {
    let frame = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const elapsed = (Date.now() - timerAnchorRef.current) / 1000;
      const remaining = Math.max(0, timerTotalRef.current - elapsed);
      setTimeLeft(remaining);
      if (remaining > 0) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    tick();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
    };
  }, [identity]);

  useEffect(() => {
    if (!isConnected) return;

    let cancelled = false;
    const userId = getPersistedUserIdForRoom(roomId);
    if (!userId) return;

    void flushQueuedParticipantAnswers(
      roomId,
      questionId,
      runId,
      userId,
      submitAnswer,
    ).then(({ sentKeys, rejectedKeys }) => {
      if (cancelled || (sentKeys.length === 0 && rejectedKeys.length === 0)) {
        return;
      }

      const receipt = readParticipantAnswerReceipt(
        roomId,
        questionId,
        runId,
      );
      if (!receipt) return;

      if (sentKeys.length > 0) {
        writeParticipantAnswerReceipt(roomId, {
          ...receipt,
          status: "sent",
          updated_at: Date.now(),
        });
        setSubmitted(true);
        setSubmitStatus("sent");
        setSubmitMessage("پاسخ شما ارسال شد.");
      } else if (rejectedKeys.length > 0) {
        writeParticipantAnswerReceipt(roomId, {
          ...receipt,
          status: "rejected",
          updated_at: Date.now(),
        });
        setSubmitted(false);
        setSubmitStatus("rejected");
        setSubmitMessage(
          "زمان پاسخ‌گویی پایان یافته یا پاسخ توسط جلسه پذیرفته نشد.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isConnected, questionId, roomId, runId, submitAnswer]);

  const isSelected = useCallback(
    (option: LegacyQuestionOption, fallbackIndex: number) =>
      selectedIndexes.includes(participantOptionIndex(option, fallbackIndex)),
    [selectedIndexes],
  );

  const toggleOption = useCallback(
    (option: LegacyQuestionOption, fallbackIndex: number) => {
      if (submitted || timeLeft <= 0) return;
      const index = participantOptionIndex(option, fallbackIndex);

      setSelectedIndexes((current) => {
        if (question.has_multiple === false) {
          return current.includes(index) ? [] : [index];
        }
        return current.includes(index)
          ? current.filter((value) => value !== index)
          : [...current, index].sort((a, b) => a - b);
      });
    },
    [question.has_multiple, submitted, timeLeft],
  );

  const submit = useCallback(async () => {
    if (
      submitInFlightRef.current ||
      submitted ||
      selectedIndexes.length === 0 ||
      questionId == null
    ) {
      return;
    }

    const userId = getPersistedUserIdForRoom(roomId);
    if (!userId) {
      setSubmitStatus("missing_identity");
      setSubmitMessage(
        "هویت شرکت‌کننده معتبر نیست. دوباره وارد جلسه شوید.",
      );
      return;
    }

    const answer: QueuedParticipantAnswer = {
      request_id: createRequestId(),
      question_id: questionId,
      selected_option_indexes: [...selectedIndexes].sort((a, b) => a - b),
      user_id: userId,
      run_id: runId,
    };

    submitInFlightRef.current = true;
    setSubmitted(true);
    setSubmitStatus(isConnected ? "sending" : "queued");
    setSubmitMessage(
      isConnected
        ? "در حال ارسال پاسخ…"
        : "اتصال قطع است؛ پاسخ ذخیره شد و پس از اتصال ارسال می‌شود.",
    );

    queueParticipantAnswer(roomId, answer);
    writeParticipantAnswerReceipt(roomId, {
      question_id: questionId,
      run_id: runId,
      selected_option_indexes: answer.selected_option_indexes,
      request_id: answer.request_id ?? "",
      status: "queued",
      updated_at: Date.now(),
    });

    if (!isConnected) {
      submitInFlightRef.current = false;
      return;
    }

    const outcome = await submitAnswer(answer);
    submitInFlightRef.current = false;

    if (outcome === true) {
      removeQueuedParticipantAnswer(roomId, answer);
      writeParticipantAnswerReceipt(roomId, {
        question_id: questionId,
        run_id: runId,
        selected_option_indexes: answer.selected_option_indexes,
        request_id: answer.request_id ?? "",
        status: "sent",
        updated_at: Date.now(),
      });
      setSubmitStatus("sent");
      setSubmitMessage("پاسخ شما ارسال شد.");
      return;
    }

    if (outcome === "rejected") {
      removeQueuedParticipantAnswer(roomId, answer);
      writeParticipantAnswerReceipt(roomId, {
        question_id: questionId,
        run_id: runId,
        selected_option_indexes: answer.selected_option_indexes,
        request_id: answer.request_id ?? "",
        status: "rejected",
        updated_at: Date.now(),
      });
      setSubmitted(false);
      setSubmitStatus("rejected");
      setSubmitMessage(
        "زمان پاسخ‌گویی پایان یافته یا پاسخ توسط جلسه پذیرفته نشد.",
      );
      return;
    }

    setSubmitStatus("queued");
    setSubmitMessage(
      "اتصال قطع شد؛ پاسخ ذخیره شده و پس از اتصال ارسال می‌شود.",
    );
  }, [
    isConnected,
    questionId,
    roomId,
    runId,
    selectedIndexes,
    submitAnswer,
    submitted,
  ]);

  useEffect(() => {
    if (timeLeft > 0 || submitted) return;
    if (selectedIndexes.length === 0) {
      setSubmitStatus("expired");
      setSubmitMessage("زمان پاسخ‌گویی پایان یافت.");
      return;
    }
    void submit();
  }, [selectedIndexes.length, submit, submitted, timeLeft]);

  const progressPercent =
    timerTotalRef.current > 0
      ? Math.max(0, Math.min(100, (timeLeft / timerTotalRef.current) * 100))
      : 0;
  const showResults = result !== null;
  const waitingForResults = timeLeft <= 0 && result === null;

  return {
    selectedIndexes,
    submitted,
    submitStatus,
    submitMessage,
    timeLeft,
    progressPercent,
    result,
    waitingForResults,
    showResults,
    canSubmit:
      selectedIndexes.length > 0 &&
      timeLeft > 0 &&
      !submitted &&
      !submitInFlightRef.current,
    isSelected,
    toggleOption,
    submit,
  };
}
