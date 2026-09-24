import type { LiveAnswerInput } from "../runtime/LiveRuntime.ts";

const LEGACY_ANSWER_QUEUE_KEY = "presentation_answer_queue_v1";
const ANSWER_QUEUE_PREFIX = "presentation_answer_queue_v3:";

type RoomId = string | number | null | undefined;

export type QueuedParticipantAnswer = LiveAnswerInput & {
  user_id: string;
  run_id?: string | number | null;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const storageOrNull = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const queueKey = (roomId: RoomId) =>
  `${ANSWER_QUEUE_PREFIX}${String(roomId ?? "unknown")}`;

const answerKey = (answer: QueuedParticipantAnswer) =>
  `${answer.user_id}:${String(answer.question_id)}:${String(answer.run_id ?? "na")}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeQueuedAnswer = (
  value: unknown,
): QueuedParticipantAnswer | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.user_id !== "string" ||
    value.user_id.trim() === "" ||
    (typeof value.question_id !== "string" &&
      typeof value.question_id !== "number") ||
    !Array.isArray(value.selected_option_indexes)
  ) {
    return null;
  }

  const selected = value.selected_option_indexes.map(Number);
  if (selected.some((index) => !Number.isInteger(index) || index < 0)) {
    return null;
  }

  return {
    request_id:
      typeof value.request_id === "string" && value.request_id
        ? value.request_id
        : undefined,
    question_id: value.question_id,
    selected_option_indexes: selected,
    user_id: value.user_id,
    run_id:
      typeof value.run_id === "string" || typeof value.run_id === "number"
        ? value.run_id
        : null,
  };
};

export const clearLegacyParticipantAnswerQueue = (
  storage: StorageLike | null = storageOrNull(),
): void => {
  try {
    storage?.removeItem(LEGACY_ANSWER_QUEUE_KEY);
  } catch {
    // Queue persistence is a best-effort continuity feature.
  }
};

export const readQueuedParticipantAnswers = (
  roomId: RoomId,
  storage: StorageLike | null = storageOrNull(),
): QueuedParticipantAnswer[] => {
  try {
    const raw = storage?.getItem(queueKey(roomId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeQueuedAnswer)
      .filter((answer): answer is QueuedParticipantAnswer => answer !== null);
  } catch {
    return [];
  }
};

export const writeQueuedParticipantAnswers = (
  roomId: RoomId,
  answers: QueuedParticipantAnswer[],
  storage: StorageLike | null = storageOrNull(),
): void => {
  try {
    if (answers.length === 0) {
      storage?.removeItem(queueKey(roomId));
      return;
    }
    storage?.setItem(queueKey(roomId), JSON.stringify(answers));
  } catch {
    // Queue persistence is a best-effort continuity feature.
  }
};

export const queueParticipantAnswer = (
  roomId: RoomId,
  answer: QueuedParticipantAnswer,
  storage: StorageLike | null = storageOrNull(),
): void => {
  const current = readQueuedParticipantAnswers(roomId, storage);
  const key = answerKey(answer);
  writeQueuedParticipantAnswers(
    roomId,
    [...current.filter((item) => answerKey(item) !== key), answer],
    storage,
  );
};

export const removeQueuedParticipantAnswer = (
  roomId: RoomId,
  answer: QueuedParticipantAnswer,
  storage: StorageLike | null = storageOrNull(),
): void => {
  const key = answerKey(answer);
  writeQueuedParticipantAnswers(
    roomId,
    readQueuedParticipantAnswers(roomId, storage).filter(
      (item) => answerKey(item) !== key,
    ),
    storage,
  );
};

export const isAnswerForQuestionRun = (
  answer: QueuedParticipantAnswer,
  questionId: string | number | null | undefined,
  runId: string | number | null | undefined,
): boolean => {
  if (questionId == null) return false;
  if (String(answer.question_id) !== String(questionId)) return false;
  if (runId == null) return true;
  return String(answer.run_id ?? "na") === String(runId);
};

export const pruneQueuedParticipantAnswers = (
  roomId: RoomId,
  questionId: string | number | null | undefined,
  runId: string | number | null | undefined,
  storage: StorageLike | null = storageOrNull(),
): void => {
  writeQueuedParticipantAnswers(
    roomId,
    readQueuedParticipantAnswers(roomId, storage).filter((answer) =>
      isAnswerForQuestionRun(answer, questionId, runId),
    ),
    storage,
  );
};

export type FlushQueuedParticipantAnswersResult = {
  sentKeys: string[];
  rejectedKeys: string[];
  remaining: number;
};

export const flushQueuedParticipantAnswers = async (
  roomId: RoomId,
  questionId: string | number | null | undefined,
  runId: string | number | null | undefined,
  submitAnswer: (
    answer: LiveAnswerInput,
  ) => Promise<true | false | "rejected">,
  storage: StorageLike | null = storageOrNull(),
): Promise<FlushQueuedParticipantAnswersResult> => {
  const current = readQueuedParticipantAnswers(roomId, storage);
  const sentKeys: string[] = [];
  const rejectedKeys: string[] = [];
  const remaining: QueuedParticipantAnswer[] = [];
  let transportFailed = false;

  for (const answer of current) {
    if (!isAnswerForQuestionRun(answer, questionId, runId)) {
      continue;
    }

    if (transportFailed) {
      remaining.push(answer);
      continue;
    }

    const outcome = await submitAnswer(answer);
    if (outcome === true) {
      sentKeys.push(answerKey(answer));
    } else if (outcome === "rejected") {
      rejectedKeys.push(answerKey(answer));
    } else {
      transportFailed = true;
      remaining.push(answer);
    }
  }

  writeQueuedParticipantAnswers(roomId, remaining, storage);
  return {
    sentKeys,
    rejectedKeys,
    remaining: remaining.length,
  };
};

export const queuedParticipantAnswerKey = answerKey;
