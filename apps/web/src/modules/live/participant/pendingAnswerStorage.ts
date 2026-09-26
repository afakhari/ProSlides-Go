import type { LiveAnswerInput } from "../runtime/LiveRuntime.ts";

type RoomId = string | number | null | undefined;

type StoredPendingAnswer = {
  room_id: string;
  identity: string;
  answer: LiveAnswerInput;
};

type ParticipantAnswerDraft =
  | { selectedIndexes: number[] }
  | { text: string };

const KEY_PREFIX = "proslides_live_pending_answer_v1:";
const DRAFT_KEY_PREFIX = "proslides_live_answer_draft_v1:";

const storageKey = (roomId: RoomId, identity: string) =>
  KEY_PREFIX + String(roomId ?? "unknown") + ":" + identity;

const draftStorageKey = (roomId: RoomId, identity: string) =>
  DRAFT_KEY_PREFIX + String(roomId ?? "unknown") + ":" + identity;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseAnswer = (value: unknown): LiveAnswerInput | null => {
  if (!isRecord(value)) return null;
  if (
    typeof value.request_id !== "string" ||
    typeof value.activity_item_id !== "string" ||
    !isRecord(value.response)
  ) {
    return null;
  }

  if (Array.isArray(value.response.selected_option_indexes)) {
    const indexes = value.response.selected_option_indexes;
    if (
      indexes.length === 0 ||
      indexes.some((index) => !Number.isInteger(index) || Number(index) < 0)
    ) {
      return null;
    }
    return {
      request_id: value.request_id,
      activity_item_id: value.activity_item_id,
      response: {
        selected_option_indexes: indexes.map(Number),
      },
    };
  }

  if (typeof value.response.text === "string" && value.response.text.trim()) {
    return {
      request_id: value.request_id,
      activity_item_id: value.activity_item_id,
      response: { text: value.response.text },
    };
  }

  return null;
};

export const readPendingAnswer = (
  roomId: RoomId,
  identity: string,
): LiveAnswerInput | null => {
  try {
    const raw = sessionStorage.getItem(storageKey(roomId, identity));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (
      String(parsed.room_id ?? "") !== String(roomId ?? "unknown") ||
      parsed.identity !== identity
    ) {
      return null;
    }
    return parseAnswer(parsed.answer);
  } catch {
    return null;
  }
};

export const savePendingAnswer = (
  roomId: RoomId,
  identity: string,
  answer: LiveAnswerInput,
): void => {
  const payload: StoredPendingAnswer = {
    room_id: String(roomId ?? "unknown"),
    identity,
    answer,
  };
  try {
    sessionStorage.setItem(storageKey(roomId, identity), JSON.stringify(payload));
  } catch {
    // Refresh recovery is best-effort when browser storage is unavailable.
  }
};

export const clearPendingAnswer = (
  roomId: RoomId,
  identity: string,
): void => {
  try {
    sessionStorage.removeItem(storageKey(roomId, identity));
  } catch {
    // Best-effort cleanup only.
  }
};


export const readAnswerDraft = (
  roomId: RoomId,
  identity: string,
): ParticipantAnswerDraft | null => {
  try {
    const raw = sessionStorage.getItem(draftStorageKey(roomId, identity));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    if (Array.isArray(parsed.selectedIndexes)) {
      const indexes = parsed.selectedIndexes;
      if (
        indexes.length > 0 &&
        indexes.every(
          (index) => Number.isInteger(index) && Number(index) >= 0,
        )
      ) {
        return { selectedIndexes: indexes.map(Number) };
      }
      return null;
    }

    if (typeof parsed.text === "string") {
      return { text: parsed.text };
    }

    return null;
  } catch {
    return null;
  }
};

export const saveAnswerDraft = (
  roomId: RoomId,
  identity: string,
  draft: ParticipantAnswerDraft,
): void => {
  try {
    sessionStorage.setItem(
      draftStorageKey(roomId, identity),
      JSON.stringify(draft),
    );
  } catch {
    // Draft preservation is best-effort when browser storage is unavailable.
  }
};

export const clearAnswerDraft = (
  roomId: RoomId,
  identity: string,
): void => {
  try {
    sessionStorage.removeItem(draftStorageKey(roomId, identity));
  } catch {
    // Best-effort cleanup only.
  }
};
