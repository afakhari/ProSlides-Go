import {
  validateEditorContent,
  type ContentValidationIssue,
  type EditorSlide,
} from "../../model/editor.ts";

export type ContentDraft = {
  slideId: string;
  revision: number;
  order: number;
  title: string;
  text: string;
  imageUrl: string;
};

export type ContentDraftState = {
  baseline: ContentDraft;
  draft: ContentDraft;
};

export type ContentDraftAction =
  | { type: "reset"; draft: ContentDraft }
  | { type: "saved"; draft: ContentDraft }
  | { type: "title"; value: string }
  | { type: "text"; value: string }
  | { type: "image"; value: string };

export const createContentDraft = (
  slide: EditorSlide,
): ContentDraft | null => {
  if (slide.slide_type !== 2) return null;
  return {
    slideId: slide.slide_id,
    revision: slide.revision,
    order: slide.order,
    title: slide.title || "",
    text: slide.content_text || "",
    imageUrl: slide.content_image_url || "",
  };
};

const patchDraft = (
  state: ContentDraftState,
  patch: Partial<ContentDraft>,
): ContentDraftState => ({
  ...state,
  draft: { ...state.draft, ...patch },
});

export function contentDraftReducer(
  state: ContentDraftState,
  action: ContentDraftAction,
): ContentDraftState {
  switch (action.type) {
    case "reset":
    case "saved":
      return { baseline: action.draft, draft: action.draft };
    case "title":
      return patchDraft(state, { title: action.value });
    case "text":
      return patchDraft(state, { text: action.value });
    case "image":
      return patchDraft(state, { imageUrl: action.value });
    default:
      return state;
  }
}

export const contentDraftEquals = (
  left: ContentDraft,
  right: ContentDraft,
): boolean =>
  left.slideId === right.slideId &&
  left.revision === right.revision &&
  left.order === right.order &&
  left.title === right.title &&
  left.text === right.text &&
  left.imageUrl === right.imageUrl;

export const validateContentDraft = (
  draft: ContentDraft,
): ContentValidationIssue[] =>
  validateEditorContent({
    title: draft.title,
    content_text: draft.text,
    content_image_url: draft.imageUrl,
  });

export const contentDraftToEditorSlide = (
  draft: ContentDraft,
): EditorSlide => {
  const issues = validateContentDraft(draft);
  if (issues.length) {
    throw new Error(issues[0].message);
  }

  return {
    slide_id: draft.slideId,
    revision: draft.revision,
    order: draft.order,
    slide_type: 2,
    show_leaderboard_after: false,
    question: null,
    title: draft.title,
    content_text: draft.text,
    content_image_url: draft.imageUrl.trim(),
  };
};
