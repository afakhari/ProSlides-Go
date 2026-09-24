import type {
  LiveEvent,
  LiveSnapshot,
  LiveState,
  ParticipantWithScore,
  PresentationSlide,
  PublicLiveSession,
  RosterEntry,
} from "../api/types.ts";
import type {
  LegacyContentSlide,
  LegacyLiveSlide,
  LegacyLiveUser,
  LegacyQuestionOption,
  LegacyQuestionSlide,
  ProjectedServerData,
} from "../model/serverData.ts";

export interface LiveCursor {
  eventId: number;
  stateVersion: number;
}

export type LiveActionName =
  | "start"
  | "open_content"
  | "open_question"
  | "close_question"
  | "show_leaderboard"
  | "end";

export type LiveNavigationCommand = "start" | "next";

export interface LiveNavigationSlide {
  slide_id?: string | number | null;
  question_time?: string | number | null;
  slide_type?: number | null;
  kind?: string | null;
  title?: string | null;
  content_text?: string | null;
  content_image_url?: string | null;
}

type ProtocolSession = Partial<
  Pick<
    PublicLiveSession,
    "active_slide_id" | "state_version" | "ends_at" | "remaining_seconds"
  >
>;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const recordValue = (value: unknown): UnknownRecord =>
  isRecord(value) ? value : {};

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const finiteNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const optionalFiniteNumber = (value: unknown): number | undefined => {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const shouldApplyLiveEvent = (
  cursor: LiveCursor,
  event: LiveEvent,
): boolean => {
  const eventId = optionalFiniteNumber(event.event_id);
  if (eventId === undefined) return false;
  if (eventId <= finiteNumber(cursor.eventId)) return false;

  return (
    finiteNumber(event.state_version) >= finiteNumber(cursor.stateVersion)
  );
};

export const advanceLiveCursor = (
  cursor: LiveCursor,
  event: LiveEvent,
): LiveCursor => ({
  eventId: Math.max(
    finiteNumber(cursor.eventId),
    finiteNumber(event.event_id),
  ),
  stateVersion: Math.max(
    finiteNumber(cursor.stateVersion),
    finiteNumber(event.state_version),
  ),
});

export const liveCursorFromSnapshot = (
  snapshot: LiveSnapshot,
): LiveCursor => ({
  eventId: finiteNumber(snapshot.last_event_id),
  stateVersion: finiteNumber(snapshot.session.state_version),
});

const isLeaderboardSlide = (
  slide: LiveNavigationSlide | null | undefined,
): boolean =>
  slide?.slide_type === 3 ||
  (slide?.slide_type === 2 &&
    !slide.title &&
    !slide.content_text &&
    !slide.content_image_url);

const openActionForSlide = (
  slide: LiveNavigationSlide | null | undefined,
): LiveActionName | null => {
  if (!slide) return null;
  if (isLeaderboardSlide(slide)) return "show_leaderboard";

  return slide.slide_type === 1 || slide.kind === "question"
    ? "open_question"
    : "open_content";
};

export const planLiveNavigation = (
  state: LiveState | undefined,
  command: LiveNavigationCommand,
  slide: LiveNavigationSlide | null = null,
): LiveActionName[] => {
  if (state === "ended") return [];

  const actions: LiveActionName[] = [];
  let projectedState = state;

  if (command === "start") {
    if (projectedState === "draft") {
      actions.push("start");
      projectedState = "lobby";
    }

    const open = openActionForSlide(slide);
    if (open) actions.push(open);
    return actions;
  }

  if (projectedState === "question_open") {
    actions.push("close_question");
    projectedState = "question_closed";
  }

  const open = openActionForSlide(slide);
  if (!slide && projectedState === "question_closed") {
    actions.push("show_leaderboard");
  } else if (open) {
    actions.push(open);
  }

  return actions;
};

export const planLiveEnd = (
  state: LiveState | undefined,
): LiveActionName[] =>
  state === "question_open"
    ? ["close_question", "end"]
    : state === "ended"
      ? []
      : ["end"];

export const normalizeLiveSlide = (
  activeSlide: unknown,
  session: ProtocolSession = {},
): LegacyLiveSlide | null => {
  if (!isRecord(activeSlide)) return null;

  const content = recordValue(activeSlide.content);
  const id = String(
    activeSlide.id ?? session.active_slide_id ?? "",
  );

  if (activeSlide.kind === "question") {
    const rawOptions = Array.isArray(content.options) ? content.options : [];
    const questionTime = finiteNumber(content.question_time);
    const endsAt =
      typeof session.ends_at === "string"
        ? Date.parse(session.ends_at)
        : Number.NaN;
    const serverRemaining = optionalFiniteNumber(
      session.remaining_seconds,
    );
    const serverRemainingSeconds =
      serverRemaining === undefined
        ? undefined
        : Math.max(
            0,
            Math.min(
              questionTime > 0 ? questionTime : serverRemaining,
              serverRemaining,
            ),
          );
    const derivedSeconds = Number.isFinite(endsAt)
      ? Math.max(0, (endsAt - Date.now()) / 1000)
      : undefined;
    const questionType = stringValue(
      content.question_type,
      "single",
    );

    const options: LegacyQuestionOption[] = rawOptions.map(
      (rawOption, index) => {
        const option = recordValue(rawOption);
        return {
          option_id: index,
          option_index: index,
          option_text: stringValue(option.text),
          image_url: stringValue(option.image_url),
          order: index,
        };
      },
    );

    const question: LegacyQuestionSlide = {
      slide_type: 1,
      slide_id: id,
      question_id: id,
      run_id: session.state_version,
      question_text: stringValue(content.text),
      question_title: stringValue(content.title),
      question_time: questionTime,
      remaining_seconds: serverRemainingSeconds ?? derivedSeconds,
      max_point: finiteNumber(content.max_point),
      min_point: finiteNumber(content.min_point),
      question_type: questionType,
      has_multiple: questionType === "multiple",
      image_url: stringValue(content.image_url),
      options,
    };

    return question;
  }

  const contentSlide: LegacyContentSlide = {
    slide_type: 2,
    slide_id: id,
    order:
      typeof activeSlide.position === "number"
        ? activeSlide.position
        : null,
    title: stringValue(content.title),
    content_text: stringValue(
      content.text ?? content.content_text,
    ),
    content_image_url: stringValue(content.image_url),
  };

  return contentSlide;
};

export const rosterEntryToLegacy = (
  entry: RosterEntry,
  index = 0,
): LegacyLiveUser => ({
  user_id: entry.participant_id,
  name: entry.display_name,
  character: entry.avatar || "",
  rank: index + 1,
  total_points: finiteNumber(entry.score),
  new_points: null,
});

export const participantToLegacy = (
  participant: ParticipantWithScore,
): LegacyLiveUser => ({
  user_id: participant.id,
  name: participant.display_name,
  character: participant.avatar || "",
  rank:
    participant.rank != null && Number.isFinite(Number(participant.rank))
      ? Number(participant.rank)
      : null,
  total_points: finiteNumber(participant.score),
  new_points: null,
});

export const presentationSlideToLegacy = (
  slide: PresentationSlide,
): LegacyQuestionSlide | LegacyContentSlide | null => {
  const content = recordValue(slide.content);

  if (slide.kind === "question_draft") {
    return {
      slide_type: 1,
      slide_id: slide.id,
      question_id: slide.id,
      question_text: "",
      question_type: "single",
      question_time: 10,
      options: [],
      show_leaderboard_after:
        content.show_leaderboard_after === true,
    };
  }

  const normalized = normalizeLiveSlide(
    {
      id: slide.id,
      position: slide.position,
      kind: slide.kind,
      content: slide.content,
    },
    {
      active_slide_id: slide.id,
      state_version: 0,
      ends_at: null,
    },
  );

  if (normalized?.slide_type !== 1) return normalized;

  const sourceOptions = Array.isArray(content.options)
    ? content.options
    : [];

  return {
    ...normalized,
    show_leaderboard_after:
      content.show_leaderboard_after === true,
    options: (normalized.options ?? []).map((option, index) => ({
      ...option,
      answer:
        recordValue(sourceOptions[index]).is_correct === true,
    })),
  };
};

export const projectLiveSnapshot = (
  snapshot: LiveSnapshot | null | undefined,
  roster: RosterEntry[] = [],
): ProjectedServerData | null => {
  if (!snapshot?.session) return null;

  const active = normalizeLiveSlide(
    snapshot.active_slide,
    snapshot.session,
  );
  const managerRows =
    snapshot.role === "manager"
      ? roster.map(rosterEntryToLegacy)
      : [];
  const participantRows =
    snapshot.role === "participant"
      ? [participantToLegacy(snapshot.participant)]
      : [];

  const leaderboard = ["leaderboard", "ended"].includes(
    snapshot.session.state,
  )
    ? snapshot.role === "manager"
      ? managerRows
      : participantRows
    : null;

  const stats = snapshot.question_stats;
  const questionResults = stats
    ? {
        question_id: stats.question_slide_id,
        optionsResult: Object.entries(
          stats.option_counts ?? {},
        ).map(([optionId, count]) => ({
          option_id: Number(optionId),
          number_of_submits: finiteNumber(count),
        })),
      }
    : null;

  return {
    users: managerRows,
    currentQuestion:
      active?.slide_type === 1 &&
      snapshot.session.state === "question_open"
        ? active
        : null,
    currentContent:
      active?.slide_type === 2 &&
      snapshot.session.state === "content"
        ? active
        : null,
    leaderboardResults: leaderboard,
    participantCount: finiteNumber(snapshot.participant_count),
    questionResults,
  };
};
