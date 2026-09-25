import type { components } from "../../../shared/api/generated/openapi.ts";

export type LiveState = "draft" | "lobby" | "presenting" | "ended";
export type ActivityPhase = "accepting" | "closed" | "revealed";
export type StageView = "item" | "overall_ranking";

export interface PublicLiveSession {
  id: string;
  presentation_id: string;
  state: LiveState;
  state_version: number;
  active_item_id: string | null;
  activity_phase: ActivityPhase | null;
  stage_view: StageView;
  ends_at: string | null;
  remaining_seconds?: number | null;
}

export interface ManagerLiveSession extends PublicLiveSession {
  host_id: string;
  join_code: string;
}

export interface ParticipantWithScore {
  id: string;
  display_name: string;
  avatar?: string;
  score: number;
  rank?: number;
}

export interface ActivityResult {
  activity_item_id: string;
  response_count: number;
  option_counts: Record<string, number>;
}

export interface PersonalActivityResult {
  activity_item_id: string;
  selected_option_indexes: number[];
  score_delta: number;
}

export interface ParticipantSnapshot {
  role: "participant";
  session: PublicLiveSession;
  active_item?: Record<string, unknown>;
  participant: ParticipantWithScore;
  personal_activity_result?: PersonalActivityResult;
  participant_count: number;
  last_event_id: number;
  activity_result?: ActivityResult;
}

export interface ManagerSnapshot {
  role: "manager";
  session: ManagerLiveSession;
  active_item?: Record<string, unknown>;
  participant_count: number;
  last_event_id: number;
  activity_result?: ActivityResult;
}

export type LiveSnapshot = ParticipantSnapshot | ManagerSnapshot;

export interface LiveEvent {
  event_id: number;
  schema_version: 1 | 2;
  session_id: string;
  state_version: number;
  name:
    | "session.created"
    | "presence.updated"
    | "session.state_changed"
    | "activity.result_updated"
    | "ranking.updated";
  payload: unknown;
  occurred_at: string;
}

export interface RosterEntry {
  participant_id: string;
  display_name: string;
  avatar?: string;
  score: number;
  rank?: number | null;
  joined_at: string;
}

export interface RosterPage {
  items: RosterEntry[];
  order: "joined" | "score";
  limit: number;
  has_more: boolean;
  next_cursor?: string;
}

export type LiveSessionResult = ManagerLiveSession;
export interface ParticipantResult {
  id: string;
  display_name: string;
  avatar?: string;
}
export interface AnswerResult {
  answer_id: string;
  score_delta: number;
  duplicate: boolean;
}
export interface LiveSessionLocator {
  session_id: string;
  presentation_id: string;
  presentation: {
    title: string;
    background_color: string;
    background_image_url: string;
    music_url: string;
    text_color: string;
  };
}
export type PresentationSlide = components["schemas"]["Slide"];
export type Presentation = components["schemas"]["Presentation"];
