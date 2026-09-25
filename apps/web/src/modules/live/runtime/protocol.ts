import type {
  ActivityPhase,
  LiveEvent,
  LiveSnapshot,
  LiveState,
  ParticipantWithScore,
  PresentationSlide,
  PublicLiveSession,
  RosterEntry,
  StageView,
} from "../api/types.ts";
import type {
  LegacyContentSlide,
  LegacyLeaderboardSlide,
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
  | "present_item"
  | "close_activity"
  | "reveal_activity"
  | "show_overall_ranking"
  | "end";

export type LiveNavigationCommand = "start" | "next";

export interface LiveNavigationSlide {
  slide_id?: string | number | null;
  question_time?: string | number | null;
  item_kind?: "activity" | "content" | "legacy-leaderboard" | null;
  title?: string | null;
  content_text?: string | null;
  content_image_url?: string | null;
  show_leaderboard_after?: boolean | null;
}

type ProtocolSession = Partial<
  Pick<
    PublicLiveSession,
    | "active_item_id"
    | "state_version"
    | "activity_phase"
    | "stage_view"
    | "ends_at"
    | "remaining_seconds"
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

  return finiteNumber(event.state_version) >= finiteNumber(cursor.stateVersion);
};

export const advanceLiveCursor = (
  cursor: LiveCursor,
  event: LiveEvent,
): LiveCursor => {
  if (!shouldApplyLiveEvent(cursor, event)) return cursor;

  return {
    eventId: finiteNumber(event.event_id, cursor.eventId),
    stateVersion: Math.max(
      finiteNumber(cursor.stateVersion),
      finiteNumber(event.state_version),
    ),
  };
};

export const liveCursorFromSnapshot = (
  snapshot: LiveSnapshot,
): LiveCursor => ({
  eventId: finiteNumber(snapshot.last_event_id),
  stateVersion: finiteNumber(snapshot.session.state_version),
});

const isLeaderboardSlide = (
  slide: LiveNavigationSlide | null | undefined,
): boolean => slide?.item_kind === "legacy-leaderboard";

const actionForSlide = (
  slide: LiveNavigationSlide | null | undefined,
): LiveActionName | null => {
  if (!slide) return null;
  return isLeaderboardSlide(slide)
    ? "show_overall_ranking"
    : "present_item";
};

export const planLiveNavigation = (
  state: LiveState | undefined,
  command: LiveNavigationCommand,
  slide: LiveNavigationSlide | null = null,
  activityPhase: ActivityPhase | null = null,
  stageView: StageView = "item",
): LiveActionName[] => {
  if (state === "ended") return [];

  const actions: LiveActionName[] = [];

  if (command === "start") {
    if (state === "draft") actions.push("start");
    const open = actionForSlide(slide);
    if (open) actions.push(open);
    return actions;
  }

  // A presenter action never skips the result boundary. A manually closed
  // Activity is revealed on the next step; an accepting Activity is closed and
  // revealed atomically from the user's perspective, while remaining two
  // durable versioned commands on the server.
  if (state === "presenting" && activityPhase === "accepting") {
    return ["close_activity", "reveal_activity"];
  }
  if (state === "presenting" && activityPhase === "closed") {
    return ["reveal_activity"];
  }

  if (
    state === "presenting" &&
    activityPhase === "revealed" &&
    stageView === "item" &&
    !slide
  ) {
    return ["show_overall_ranking"];
  }

  const open = actionForSlide(slide);
  if (open) actions.push(open);
  return actions;
};

export const planLiveEnd = (
  state: LiveState | undefined,
  activityPhase: ActivityPhase | null = null,
): LiveActionName[] =>
  state === "presenting" && activityPhase === "accepting"
    ? ["close_activity", "end"]
    : state === "ended"
      ? []
      : ["end"];

const choiceActivityToLegacy = (
  id: string,
  content: UnknownRecord,
  session: ProtocolSession,
): LegacyQuestionSlide => {
  const prompt = recordValue(content.prompt);
  const response = recordValue(content.response);
  const evaluation = recordValue(content.evaluation);
  const scoring = recordValue(content.scoring);
  const timing = recordValue(content.timing);
  const results = recordValue(content.results);
  const rawOptions = Array.isArray(response.options) ? response.options : [];
  const correctOptionIds = new Set(
    Array.isArray(evaluation.correct_option_ids)
      ? evaluation.correct_option_ids.map(String)
      : [],
  );
  const questionTime = finiteNumber(timing.duration_seconds);
  const endsAt =
    typeof session.ends_at === "string"
      ? Date.parse(session.ends_at)
      : Number.NaN;
  const serverRemaining = optionalFiniteNumber(session.remaining_seconds);
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
  const questionType =
    response.selection === "multiple" ? "multiple" : "single";

  const options: LegacyQuestionOption[] = rawOptions.map(
    (rawOption, index) => {
      const option = recordValue(rawOption);
      const optionId = String(option.id ?? "");
      return {
        option_id: index,
        option_index: index,
        option_text: stringValue(option.text),
        image_url: stringValue(option.image_url),
        order: index,
        ...(correctOptionIds.size > 0
          ? { answer: correctOptionIds.has(optionId) }
          : {}),
      };
    },
  );

  return {
    item_kind: "activity",
    slide_id: id,
    activity_kind: "choice",
    question_id: id,
    run_id: session.state_version,
    question_text: stringValue(prompt.text),
    question_title: stringValue(prompt.title),
    question_time: questionTime,
    remaining_seconds: serverRemainingSeconds ?? derivedSeconds,
    max_point: finiteNumber(scoring.max_points),
    min_point: finiteNumber(scoring.min_points),
    question_type: questionType,
    has_multiple: questionType === "multiple",
    is_scored: scoring.mode === "points",
    has_correct_answer: evaluation.mode === "correctness",
    image_url: stringValue(prompt.image_url),
    show_leaderboard_after:
      results.show_overall_leaderboard_after === true,
    options,
  };
};

const textActivityToLegacy = (
  id: string,
  content: UnknownRecord,
  session: ProtocolSession,
): LegacyQuestionSlide => {
  const prompt = recordValue(content.prompt);
  const response = recordValue(content.response);
  const timing = recordValue(content.timing);
  const questionTime = finiteNumber(timing.duration_seconds);
  const endsAt =
    typeof session.ends_at === "string"
      ? Date.parse(session.ends_at)
      : Number.NaN;
  const serverRemaining = optionalFiniteNumber(session.remaining_seconds);
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

  return {
    item_kind: "activity",
    slide_id: id,
    activity_kind: "text",
    question_id: id,
    run_id: session.state_version,
    question_text: stringValue(prompt.text),
    question_title: stringValue(prompt.title),
    question_time: questionTime,
    remaining_seconds: serverRemainingSeconds ?? derivedSeconds,
    question_type: "text",
    has_multiple: false,
    is_scored: false,
    has_correct_answer: false,
    image_url: stringValue(prompt.image_url),
    show_leaderboard_after: false,
    response_max_length: finiteNumber(response.max_length),
    response_max_words: finiteNumber(response.max_words),
    options: [],
  };
};

export const normalizeLiveSlide = (
  activeItem: unknown,
  session: ProtocolSession = {},
): LegacyLiveSlide | null => {
  if (!isRecord(activeItem)) return null;

  const content = recordValue(activeItem.content);
  const id = String(activeItem.id || session.active_item_id || "");

  if (activeItem.kind === "activity") {
    if (content.activity_kind === "choice") {
      return choiceActivityToLegacy(id, content, session);
    }
    if (content.activity_kind === "text") {
      return textActivityToLegacy(id, content, session);
    }
    return null;
  }

  if (activeItem.kind !== "content") return null;

  const contentSlide: LegacyContentSlide = {
    item_kind: "content",
    slide_id: id,
    order:
      typeof activeItem.position === "number" ||
      typeof activeItem.position === "string"
        ? activeItem.position
        : null,
    title: stringValue(content.title),
    content_text:
      stringValue(content.text) ||
      stringValue(content.content_text),
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
  rank:
    entry.rank != null && Number.isFinite(Number(entry.rank))
      ? Number(entry.rank)
      : index + 1,
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

  if (
    slide.kind === "activity" &&
    (content.activity_kind === "choice" || content.activity_kind === "text")
  ) {
    const project =
      content.activity_kind === "text"
        ? textActivityToLegacy
        : choiceActivityToLegacy;
    return project(slide.id, content, {
      active_item_id: slide.id,
      state_version: 0,
      ends_at: null,
      activity_phase: null,
      stage_view: "item",
    });
  }

  if (slide.kind === "leaderboard") {
    const leaderboard: LegacyLeaderboardSlide = {
      item_kind: "legacy-leaderboard",
      slide_id: slide.id,
      order: slide.position,
      title: stringValue(content.title, "Leaderboard"),
    };
    return leaderboard;
  }

  return normalizeLiveSlide(
    {
      id: slide.id,
      position: slide.position,
      kind: slide.kind,
      content: slide.content,
    },
    {
      active_item_id: slide.id,
      state_version: 0,
      ends_at: null,
      activity_phase: null,
      stage_view: "item",
    },
  );
};

export const projectLiveSnapshot = (
  snapshot: LiveSnapshot | null | undefined,
  roster: RosterEntry[] = [],
): ProjectedServerData | null => {
  if (!snapshot?.session) return null;

  const active = normalizeLiveSlide(
    snapshot.active_item,
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

  const leaderboard =
    snapshot.session.stage_view === "overall_ranking" ||
    snapshot.session.state === "ended"
      ? snapshot.role === "manager"
        ? managerRows.slice(0, 5)
        : participantRows
      : null;

  const result = snapshot.activity_result;
  const questionResults = result
    ? result.activity_kind === "text"
      ? {
          question_id: result.activity_item_id,
          response_count: result.response_count,
          wordTerms:
            "terms" in result.payload
              ? result.payload.terms
              : [],
        }
      : {
          question_id: result.activity_item_id,
          response_count: result.response_count,
          optionsResult: Object.entries(
            "option_counts" in result.payload
              ? result.payload.option_counts
              : {},
          ).map(([optionId, count]) => ({
            option_id: Number(optionId),
            number_of_submits: finiteNumber(count),
          })),
        }
    : null;

  const activityVisibleToLegacyQuestion =
    active?.item_kind === "activity" &&
    snapshot.session.state === "presenting" &&
    snapshot.session.stage_view === "item" &&
    (
      snapshot.session.activity_phase === "accepting" ||
      snapshot.session.activity_phase === "revealed" ||
      (snapshot.role === "manager" &&
        snapshot.session.activity_phase === "closed")
    );

  return {
    users: managerRows,
    currentQuestion:
      activityVisibleToLegacyQuestion && active?.item_kind === "activity"
        ? active
        : null,
    currentContent:
      active?.item_kind === "content" &&
      snapshot.session.state === "presenting" &&
      snapshot.session.stage_view === "item"
        ? active
        : null,
    leaderboardResults: leaderboard,
    participantCount: finiteNumber(snapshot.participant_count),
    questionResults,
  };
};
