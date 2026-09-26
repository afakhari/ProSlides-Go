import {
  validateContentDraft,
  type ContentDraft,
} from "./contentDraft.ts";

type ContentPreviewModel = {
  title: string;
  text: string;
  imageUrl: string;
  hasTitle: boolean;
  hasText: boolean;
  hasImage: boolean;
  validationIssueCount: number;
};

export const createContentPreviewModel = (
  draft: ContentDraft,
): ContentPreviewModel => {
  const title = draft.title.trim();
  const text = draft.text.trim();
  const imageUrl = draft.imageUrl.trim();

  return {
    title,
    text,
    imageUrl,
    hasTitle: Boolean(title),
    hasText: Boolean(text),
    hasImage: Boolean(imageUrl),
    validationIssueCount: validateContentDraft(draft).length,
  };
};
