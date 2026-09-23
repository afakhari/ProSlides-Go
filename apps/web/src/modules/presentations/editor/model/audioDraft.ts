import type { EditorPresentation } from "../../model/editor.ts";

export const AUDIO_LIMITS = {
  url: 4_096,
} as const;

export type AudioDraft = {
  presentationId: string;
  revision: number;
  musicUrl: string;
};

export type AudioDraftState = {
  baseline: AudioDraft;
  draft: AudioDraft;
};

export type AudioDraftAction =
  | { type: "reset"; draft: AudioDraft }
  | { type: "saved"; draft: AudioDraft }
  | { type: "music-url"; value: string };

export type AudioValidationIssue = {
  code: "music_url_too_long" | "music_url_invalid";
  field: "music_url";
  message: string;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
};

export const createAudioDraft = (
  presentation: EditorPresentation,
): AudioDraft => ({
  presentationId: presentation.quiz_id,
  revision: presentation.revision,
  musicUrl: String(presentation.music_url || "").trim(),
});

export function audioDraftReducer(
  state: AudioDraftState,
  action: AudioDraftAction,
): AudioDraftState {
  switch (action.type) {
    case "reset":
    case "saved":
      return { baseline: action.draft, draft: action.draft };
    case "music-url":
      return {
        ...state,
        draft: { ...state.draft, musicUrl: action.value },
      };
    default:
      return state;
  }
}

export const audioDraftEquals = (
  left: AudioDraft,
  right: AudioDraft,
): boolean =>
  left.presentationId === right.presentationId &&
  left.revision === right.revision &&
  left.musicUrl === right.musicUrl;

export const validateAudioDraft = (
  draft: AudioDraft,
): AudioValidationIssue[] => {
  const value = draft.musicUrl.trim();
  if (Array.from(value).length > AUDIO_LIMITS.url) {
    return [{
      code: "music_url_too_long",
      field: "music_url",
      message: "آدرس فایل صوتی بیش از حد طولانی است.",
    }];
  }
  if (value && !isHttpUrl(value)) {
    return [{
      code: "music_url_invalid",
      field: "music_url",
      message: "آدرس فایل صوتی باید با http:// یا https:// شروع شود و یک میزبان معتبر داشته باشد.",
    }];
  }
  return [];
};

export const audioDraftToUpdate = (
  draft: AudioDraft,
): { music_url: string; revision: number } => {
  const issues = validateAudioDraft(draft);
  if (issues.length) {
    throw new Error(issues[0].message);
  }
  return {
    music_url: draft.musicUrl.trim(),
    revision: draft.revision,
  };
};
