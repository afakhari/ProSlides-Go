type RoomId = string | number | null | undefined;

export type ParticipantAnswerStatus = "queued" | "sent" | "rejected";

export type ParticipantAnswerReceipt = {
  question_id: string | number;
  run_id?: string | number | null;
  selected_option_indexes: number[];
  request_id: string;
  status: ParticipantAnswerStatus;
  updated_at: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const PREFIX = "presentation_answer_receipt_v1:";

const storageOrNull = (): StorageLike | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const keyForRoom = (roomId: RoomId) =>
  `${PREFIX}${String(roomId ?? "unknown")}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameRun = (
  receipt: ParticipantAnswerReceipt,
  questionId: string | number | null | undefined,
  runId: string | number | null | undefined,
) =>
  questionId != null &&
  String(receipt.question_id) === String(questionId) &&
  (runId == null || String(receipt.run_id ?? "na") === String(runId));

export const readParticipantAnswerReceipt = (
  roomId: RoomId,
  questionId: string | number | null | undefined,
  runId: string | number | null | undefined,
  storage: StorageLike | null = storageOrNull(),
): ParticipantAnswerReceipt | null => {
  try {
    const raw = storage?.getItem(keyForRoom(roomId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      (parsed.status !== "queued" &&
        parsed.status !== "sent" &&
        parsed.status !== "rejected") ||
      typeof parsed.request_id !== "string" ||
      !Array.isArray(parsed.selected_option_indexes) ||
      (typeof parsed.question_id !== "string" &&
        typeof parsed.question_id !== "number")
    ) {
      return null;
    }

    const selected = parsed.selected_option_indexes.map(Number);
    if (selected.some((index) => !Number.isInteger(index) || index < 0)) {
      return null;
    }

    const receipt: ParticipantAnswerReceipt = {
      question_id: parsed.question_id,
      run_id:
        typeof parsed.run_id === "string" || typeof parsed.run_id === "number"
          ? parsed.run_id
          : null,
      selected_option_indexes: selected,
      request_id: parsed.request_id,
      status: parsed.status,
      updated_at: Number(parsed.updated_at || 0),
    };

    return sameRun(receipt, questionId, runId) ? receipt : null;
  } catch {
    return null;
  }
};

export const writeParticipantAnswerReceipt = (
  roomId: RoomId,
  receipt: ParticipantAnswerReceipt,
  storage: StorageLike | null = storageOrNull(),
): void => {
  try {
    storage?.setItem(keyForRoom(roomId), JSON.stringify(receipt));
  } catch {
    // Receipt persistence improves reload behavior but is not authoritative.
  }
};

export const removeParticipantAnswerReceipt = (
  roomId: RoomId,
  storage: StorageLike | null = storageOrNull(),
): void => {
  try {
    storage?.removeItem(keyForRoom(roomId));
  } catch {
    // Best effort.
  }
};
