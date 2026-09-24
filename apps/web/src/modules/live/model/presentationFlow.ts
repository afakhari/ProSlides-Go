import type { LivePresentationModel } from "./presentation.ts";
import type {
  LegacyContentSlide,
  LegacyLiveSlide,
  LegacyQuestionSlide,
} from "./serverData.ts";

type RoomId = string | number | null | undefined;
type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export type PlayerLastActive =
  | {
      kind: "question";
      payload: LegacyQuestionSlide;
      updatedAt: number;
    }
  | {
      kind: "content";
      payload: LegacyContentSlide;
      updatedAt: number;
    };

export const EMPTY_PRESENTATION: LivePresentationModel = {
  quiz_id: "",
  title: "",
  access_code: "",
  background: {
    color: "#1e1e2e",
    image: "",
    text_color: "#111827",
  },
  music_url: "",
  slides: [],
  text_color: "#111827",
};

const playerSeenKey = (roomId: RoomId) =>
  `presentation_player_seen_active_v1:${String(roomId || "unknown")}`;

const playerLastActiveKey = (roomId: RoomId) =>
  `presentation_player_last_active_v1:${String(roomId || "unknown")}`;

const sessionStorageOrNull = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

const localStorageOrNull = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isQuestionPayload = (value: unknown): value is LegacyQuestionSlide =>
  isRecord(value) &&
  (value.slide_type === 1 || value.question_id != null);

const isContentPayload = (value: unknown): value is LegacyContentSlide =>
  isRecord(value) &&
  value.slide_type !== 1 &&
  (
    String(value.title ?? "").trim().length > 0 ||
    String(value.content_text ?? "").trim().length > 0 ||
    String(value.content_image_url ?? "").trim().length > 0
  );

export const readPlayerSeenActive = (
  roomId: RoomId,
  storage: ReadableStorage | null = sessionStorageOrNull(),
): boolean => {
  try {
    return storage?.getItem(playerSeenKey(roomId)) === "1";
  } catch {
    return false;
  }
};

export const persistPlayerSeenActive = (
  roomId: RoomId,
  storage: WritableStorage | null = sessionStorageOrNull(),
): void => {
  try {
    storage?.setItem(playerSeenKey(roomId), "1");
  } catch {
    // Storage is a best-effort resume optimization.
  }
};

export const readPlayerLastActive = (
  roomId: RoomId,
  storage: ReadableStorage | null = localStorageOrNull(),
): PlayerLastActive | null => {
  try {
    const raw = storage?.getItem(playerLastActiveKey(roomId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.kind !== "string") return null;
    const updatedAt = Number(parsed.updatedAt);
    if (!Number.isFinite(updatedAt)) return null;

    if (parsed.kind === "question" && isQuestionPayload(parsed.payload)) {
      return {
        kind: "question",
        payload: parsed.payload,
        updatedAt,
      };
    }

    if (parsed.kind === "content" && isContentPayload(parsed.payload)) {
      return {
        kind: "content",
        payload: parsed.payload,
        updatedAt,
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const persistPlayerLastActive = (
  roomId: RoomId,
  active: PlayerLastActive,
  storage: WritableStorage | null = localStorageOrNull(),
): void => {
  try {
    storage?.setItem(playerLastActiveKey(roomId), JSON.stringify(active));
  } catch {
    // Storage is a best-effort resume optimization.
  }
};

export const isQuestionSlide = (
  slide: unknown,
): slide is LegacyQuestionSlide =>
  isRecord(slide) &&
  (slide.slide_type === 1 || slide.question_id != null);

export const hasContentPayload = (slide: unknown): boolean =>
  isRecord(slide) &&
  (
    String(slide.title ?? "").trim().length > 0 ||
    String(slide.content_text ?? "").trim().length > 0 ||
    String(slide.content_image_url ?? "").trim().length > 0
  );

export const isLeaderboardSlide = (slide: unknown): boolean => {
  if (!isRecord(slide)) return false;
  if (slide.slide_type === 3) return true;
  if (isQuestionSlide(slide)) return false;
  return slide.slide_type === 2 && !hasContentPayload(slide);
};

export const isContentSlide = (
  slide: unknown,
): slide is LegacyContentSlide =>
  isRecord(slide) &&
  !isQuestionSlide(slide) &&
  hasContentPayload(slide);

export type PresentationSlide = LegacyLiveSlide | null;

export type ManagerPresentationView =
  | "ManagerJoinPage"
  | "ManagerPickAnswerQuestion"
  | "ManagerLeaderBoard"
  | "ManagerContentSlide"
  | "ManagerFinalLeaderboard";

export const findQuestionSlideIndex = (
  slides: PresentationSlide[],
  questionId: string | number | null | undefined,
): number => {
  if (questionId == null) return -1;

  return slides.findIndex(
    (slide) =>
      isQuestionSlide(slide) &&
      String(slide.question_id ?? slide.question?.question_id ?? "") ===
        String(questionId),
  );
};

export const findContentSlideIndex = (
  slides: PresentationSlide[],
  content: LegacyContentSlide,
): number => {
  const incomingOrder =
    content.order ?? content.slide_order ?? content.slideOrder ?? null;

  return slides.findIndex(
    (slide) =>
      isContentSlide(slide) &&
      (
        slide.slide_id === content.slide_id ||
        (incomingOrder != null && slide.order === incomingOrder)
      ),
  );
};

export const findLeaderboardSlideIndex = ({
  slides,
  currentSlide,
  lastQuestionSlideIndex,
}: {
  slides: PresentationSlide[];
  currentSlide: number;
  lastQuestionSlideIndex: number | null;
}): number => {
  if (lastQuestionSlideIndex != null) {
    const questionOrder = slides[lastQuestionSlideIndex]?.order ?? null;

    if (questionOrder != null) {
      const sameOrderIndex = slides.findIndex(
        (slide, index) =>
          index !== lastQuestionSlideIndex &&
          !isQuestionSlide(slide) &&
          isRecord(slide) &&
          slide.order === questionOrder,
      );
      if (sameOrderIndex >= 0) return sameOrderIndex;
    }

    const immediateIndex = lastQuestionSlideIndex + 1;
    if (isLeaderboardSlide(slides[immediateIndex])) {
      return immediateIndex;
    }

    const followingIndex = slides.findIndex(
      (slide, index) =>
        index > lastQuestionSlideIndex && isLeaderboardSlide(slide),
    );
    if (followingIndex >= 0) return followingIndex;
  }

  const currentIndex = Math.max(0, currentSlide - 1);
  if (isLeaderboardSlide(slides[currentIndex])) {
    return currentIndex;
  }

  return slides.findIndex((slide) => isLeaderboardSlide(slide));
};
