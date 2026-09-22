import { presentationTheme } from "../../../../shared/styles/presentationTheme.ts";
import type { EditorPresentation } from "../../model/editor.ts";

export const DESIGN_LIMITS = {
  imageUrl: 4_096,
} as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const HTTP_URL = /^https?:\/\//i;

export type DesignDraft = {
  presentationId: string;
  revision: number;
  backgroundColor: string;
  backgroundImageUrl: string;
  textColor: string;
};

export type DesignDraftState = {
  baseline: DesignDraft;
  draft: DesignDraft;
};

export type DesignDraftAction =
  | { type: "reset"; draft: DesignDraft }
  | { type: "saved"; draft: DesignDraft }
  | { type: "background-color"; value: string }
  | { type: "background-image"; value: string }
  | { type: "text-color"; value: string };

export type DesignValidationIssue = {
  code: string;
  field: "background_color" | "background_image" | "text_color";
  message: string;
};

const normalizeHex = (value: unknown, fallback: string): string => {
  const candidate = String(value ?? "").trim();
  return HEX_COLOR.test(candidate) ? candidate.toLowerCase() : fallback;
};

const readableForeground = (
  backgroundColor: string,
  requestedTextColor: string,
): string =>
  presentationTheme({
    background: {
      color: backgroundColor,
      text_color: requestedTextColor,
    },
    text_color: requestedTextColor,
  }).foreground;

export const createDesignDraft = (
  presentation: EditorPresentation,
): DesignDraft => {
  const backgroundColor = normalizeHex(
    presentation.background_color,
    "#f7f7fb",
  );
  const requestedText = normalizeHex(
    presentation.text_color,
    "#111827",
  );

  return {
    presentationId: presentation.quiz_id,
    revision: presentation.revision,
    backgroundColor,
    backgroundImageUrl: String(
      presentation.background_image_url || "",
    ).trim(),
    textColor: readableForeground(backgroundColor, requestedText),
  };
};

const patchDraft = (
  state: DesignDraftState,
  patch: Partial<DesignDraft>,
): DesignDraftState => ({
  ...state,
  draft: { ...state.draft, ...patch },
});

export function designDraftReducer(
  state: DesignDraftState,
  action: DesignDraftAction,
): DesignDraftState {
  switch (action.type) {
    case "reset":
    case "saved":
      return { baseline: action.draft, draft: action.draft };
    case "background-color": {
      const backgroundColor = normalizeHex(
        action.value,
        state.draft.backgroundColor,
      );
      return patchDraft(state, {
        backgroundColor,
        textColor: readableForeground(
          backgroundColor,
          state.draft.textColor,
        ),
      });
    }
    case "background-image":
      return patchDraft(state, {
        backgroundImageUrl: action.value.trim(),
      });
    case "text-color": {
      const requested = normalizeHex(
        action.value,
        state.draft.textColor,
      );
      return patchDraft(state, {
        textColor: readableForeground(
          state.draft.backgroundColor,
          requested,
        ),
      });
    }
    default:
      return state;
  }
}

export const designDraftEquals = (
  left: DesignDraft,
  right: DesignDraft,
): boolean =>
  left.presentationId === right.presentationId &&
  left.revision === right.revision &&
  left.backgroundColor === right.backgroundColor &&
  left.backgroundImageUrl === right.backgroundImageUrl &&
  left.textColor === right.textColor;

export const validateDesignDraft = (
  draft: DesignDraft,
): DesignValidationIssue[] => {
  const issues: DesignValidationIssue[] = [];

  if (!HEX_COLOR.test(draft.backgroundColor)) {
    issues.push({
      code: "background_color_invalid",
      field: "background_color",
      message: "رنگ پس‌زمینه معتبر نیست.",
    });
  }

  if (!HEX_COLOR.test(draft.textColor)) {
    issues.push({
      code: "text_color_invalid",
      field: "text_color",
      message: "رنگ متن معتبر نیست.",
    });
  }

  const image = draft.backgroundImageUrl.trim();
  if (Array.from(image).length > DESIGN_LIMITS.imageUrl) {
    issues.push({
      code: "background_image_too_long",
      field: "background_image",
      message: "آدرس تصویر پس‌زمینه بیش از حد طولانی است.",
    });
  } else if (image && !HTTP_URL.test(image)) {
    issues.push({
      code: "background_image_invalid",
      field: "background_image",
      message: "آدرس تصویر باید با http:// یا https:// شروع شود.",
    });
  }

  return issues;
};

export const designDraftToUpdate = (
  draft: DesignDraft,
) => {
  const issues = validateDesignDraft(draft);
  if (issues.length) {
    throw new Error(issues[0].message);
  }

  return {
    background_color: draft.backgroundColor,
    background_image_url: draft.backgroundImageUrl,
    text_color: draft.textColor,
    revision: draft.revision,
  };
};
