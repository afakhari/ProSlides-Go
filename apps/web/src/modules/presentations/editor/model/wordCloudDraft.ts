import {
  validateEditorTextActivity,
  type EditorSlide,
  type TextActivityValidationIssue,
} from "../../model/editor.ts";

export type WordCloudDraft = {
  slideId: string;
  revision: number;
  order: number;
  title: string;
  prompt: string;
  imageUrl: string;
  maxLength: number;
  maxWords: number;
  durationSeconds: number;
};

type WordCloudDraftState = {
  baseline: WordCloudDraft;
  draft: WordCloudDraft;
};

type WordCloudDraftAction =
  | { type: "reset"; draft: WordCloudDraft }
  | { type: "saved"; draft: WordCloudDraft }
  | { type: "title"; value: string }
  | { type: "prompt"; value: string }
  | { type: "image"; value: string }
  | { type: "max-length"; value: number }
  | { type: "max-words"; value: number }
  | { type: "duration"; value: number };

export const createWordCloudDraft = (
  slide: EditorSlide,
): WordCloudDraft | null => {
  if (
    slide.item_kind !== "activity" ||
    slide.activity_kind !== "text" ||
    slide.schema_version !== 1 ||
    !slide.text_activity
  ) {
    return null;
  }

  return {
    slideId: slide.slide_id,
    revision: slide.revision,
    order: slide.order,
    title: slide.text_activity.title || "",
    prompt: slide.text_activity.text || "",
    imageUrl: slide.text_activity.image_url || "",
    maxLength: Number(slide.text_activity.max_length || 80),
    maxWords: Number(slide.text_activity.max_words || 3),
    durationSeconds: Number(slide.text_activity.time_limit || 30),
  };
};

const patchDraft = (
  state: WordCloudDraftState,
  patch: Partial<WordCloudDraft>,
): WordCloudDraftState => ({
  ...state,
  draft: { ...state.draft, ...patch },
});

export function wordCloudDraftReducer(
  state: WordCloudDraftState,
  action: WordCloudDraftAction,
): WordCloudDraftState {
  switch (action.type) {
    case "reset":
    case "saved":
      return { baseline: action.draft, draft: action.draft };
    case "title":
      return patchDraft(state, { title: action.value });
    case "prompt":
      return patchDraft(state, { prompt: action.value });
    case "image":
      return patchDraft(state, { imageUrl: action.value });
    case "max-length":
      return patchDraft(state, { maxLength: action.value });
    case "max-words":
      return patchDraft(state, { maxWords: action.value });
    case "duration":
      return patchDraft(state, { durationSeconds: action.value });
  }
}

export const wordCloudDraftEquals = (
  left: WordCloudDraft,
  right: WordCloudDraft,
): boolean =>
  left.slideId === right.slideId &&
  left.revision === right.revision &&
  left.order === right.order &&
  left.title === right.title &&
  left.prompt === right.prompt &&
  left.imageUrl === right.imageUrl &&
  left.maxLength === right.maxLength &&
  left.maxWords === right.maxWords &&
  left.durationSeconds === right.durationSeconds;

export const validateWordCloudDraft = (
  draft: WordCloudDraft,
): TextActivityValidationIssue[] =>
  validateEditorTextActivity({
    title: draft.title,
    text: draft.prompt,
    image_url: draft.imageUrl,
    max_length: draft.maxLength,
    max_words: draft.maxWords,
    time_limit: draft.durationSeconds,
    aggregation: "word_frequency",
  });

export const wordCloudDraftToEditorSlide = (
  draft: WordCloudDraft,
): EditorSlide => {
  const issues = validateWordCloudDraft(draft);
  if (issues.length) {
    throw new Error(issues[0].message);
  }

  return {
    slide_id: draft.slideId,
    revision: draft.revision,
    order: draft.order,
    item_kind: "activity",
    activity_kind: "text",
    schema_version: 1,
    show_leaderboard_after: false,
    question: null,
    text_activity: {
      title: draft.title,
      text: draft.prompt,
      image_url: draft.imageUrl.trim(),
      max_length: draft.maxLength,
      max_words: draft.maxWords,
      time_limit: draft.durationSeconds,
      aggregation: "word_frequency",
    },
  };
};
