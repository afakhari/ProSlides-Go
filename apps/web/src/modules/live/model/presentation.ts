import type { LiveClientRole } from "../runtime/LiveRuntime.ts";
import type { LegacyLiveSlide } from "./serverData.ts";

export interface LivePresentationBackground {
  color: string;
  image: string;
  text_color?: string;
}

export interface LivePresentationModel {
  quiz_id: string;
  title: string;
  access_code: string;
  background: LivePresentationBackground;
  music_url: string;
  slides: Array<LegacyLiveSlide | null>;
  text_color?: string;
}

export interface AppPresentationProps {
  roomId?: string;
  role: LiveClientRole;
  initialQuizData?: LivePresentationModel | null;
}

