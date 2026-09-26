import type { LiveAnswerInput } from "../runtime/LiveRuntime.ts";

type RoomId = string | number | null | undefined;

type StoredPendingAnswer = {
  room_id: string;
  identity: string;
  answer: LiveAnswerInput;
};

const KEY_PREFIX = "proslides_live_pending_answer_v1:";

const storageKey = (roomId: RoomId, identity: string) =>
  KEY_PREFIX + String(roomId ?? "unknown") + ":" + identity;

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
