import type { components } from "../shared/api/generated/openapi.ts";

export type LiveState = "draft" | "lobby" | "content" | "question_open" | "question_closed" | "leaderboard" | "ended";

export interface PublicLiveSession {
  id: string;
  presentation_id: string;
  state: LiveState;
  state_version: number;
  active_slide_id: string | null;
  ends_at: string | null;
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

export interface ParticipantSnapshot {
  role: "participant";
  session: PublicLiveSession;
  active_slide?: Record<string, unknown>;
  participant: ParticipantWithScore;
  participant_count: number;
  last_event_id: number;
  question_stats?: QuestionStats;
}

export interface ManagerSnapshot {
  role: "manager";
  session: ManagerLiveSession;
  active_slide?: Record<string, unknown>;
  participant_count: number;
  last_event_id: number;
  question_stats?: QuestionStats;
}

export interface QuestionStats {
  question_slide_id: string;
  response_count: number;
  option_counts: Record<string, number>;
}

export type LiveSnapshot = ParticipantSnapshot | ManagerSnapshot;

export interface LiveEvent {
  event_id: number;
  schema_version: 1 | 2;
  session_id: string;
  state_version: number;
  name: "session.created" | "presence.updated" | "session.state_changed" | "answer.stats" | "leaderboard.updated";
  payload: unknown;
  occurred_at: string;
}

export interface RosterEntry {
  participant_id: string;
  display_name: string;
  avatar?: string;
  score: number;
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
export interface ParticipantResult { id: string; display_name: string; avatar?: string }
export interface AnswerResult { answer_id: string; score_delta: number; duplicate: boolean }
export interface LiveSessionLocator {
  session_id: string;
  presentation_id: string;
  presentation: {
    title: string;
    background_color: string;
    background_image_url: string;
    text_color: string;
  };
}
export type PresentationSlide = components["schemas"]["Slide"];
export type Presentation = components["schemas"]["Presentation"];
