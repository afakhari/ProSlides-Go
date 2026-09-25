import type { LiveSnapshot } from "../api/types.ts";

export interface LegacyLiveUser {
  user_id: string;
  name: string;
  character: string;
  rank: number | null;
  total_points: number;
  new_points: number | null;
}

export interface LegacyQuestionOption {
  option_id: string | number;
  option_index?: string | number;
  option_text: string;
  image_url?: string;
  order?: number;
  answer?: boolean;
  picked?: boolean;
  number_of_submits?: number;
}

export interface LegacyQuestionSlide {
  item_kind: "activity";
  slide_id?: string | number | null;
  order?: string | number | null;
  question_id?: string | number | null;
  question?: {
    question_id?: string | number | null;
  };
  run_id?: string | number | null;
  activity_kind?: "choice" | "text";
  question_text?: string;
  question_title?: string;
  question_time?: string | number | null;
  remaining_seconds?: number;
  max_point?: number;
  min_point?: number;
  question_type?: string;
  has_multiple?: boolean;
  is_scored?: boolean;
  has_correct_answer?: boolean;
  image_url?: string;
  show_leaderboard_after?: boolean;
  response_max_length?: number;
  response_max_words?: number;
  options?: LegacyQuestionOption[];
}

export interface LegacyContentSlide {
  item_kind: "content";
  slide_id?: string | number | null;
  order?: string | number | null;
  slide_order?: string | number | null;
  slideOrder?: string | number | null;
  title?: string;
  content_text?: string;
  content_image_url?: string;
}

export type LegacyLiveSlide =
  | LegacyQuestionSlide
  | LegacyContentSlide;

export interface LegacyQuestionResult {
  question_id?: string | number | null;
  response_count?: number;
  optionsResult?: Array<{
    option_id: string | number;
    number_of_submits?: number;
    answer?: boolean;
  }>;
  wordTerms?: Array<{
    text: string;
    count: number;
  }>;
}

export interface ProjectedServerData {
  users: LegacyLiveUser[];
  currentQuestion: LegacyQuestionSlide | null;
  currentContent: LegacyContentSlide | null;
  leaderboardResults: LegacyLiveUser[] | null;
  participantCount: number;
  questionResults: LegacyQuestionResult | null;
}

export interface ServerDataFields extends ProjectedServerData {
  managerLastLeaderboard: LegacyLiveUser[] | null;
  modalLeaderboardResults: LegacyLiveUser[] | null;
}

export interface ServerDataValue extends ServerDataFields {
  serverData: ServerDataFields;
}

export const isManagerSnapshot = (
  snapshot: LiveSnapshot | null | undefined,
): snapshot is Extract<LiveSnapshot, { role: "manager" }> =>
  snapshot?.role === "manager";
