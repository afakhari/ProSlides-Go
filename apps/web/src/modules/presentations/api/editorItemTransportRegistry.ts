import type { components } from "../../../shared/api/generated/openapi.ts";
import type {
  EditorOption,
  EditorSlide,
  QuestionType,
} from "../model/editor.ts";
import {
  resolveEditorItemRegistration,
  type EditorItemRegistryKey,
} from "../model/itemRegistry.ts";

type SlideDTO = components["schemas"]["Slide"];
type CreateSlideRequestDTO = components["schemas"]["CreateSlideRequest"];

type TransportContext = {
  slide: SlideDTO;
  content: Record<string, unknown>;
};

type EditorTransportRegistration = {
  key: EditorItemRegistryKey | "choice-draft" | "legacy-question";
  matchesTransport: (context: TransportContext) => boolean;
  fromTransport: (context: TransportContext) => EditorSlide;
};

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const numberValue = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const recordValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const stringArrayValue = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const normalizeOption = (
  option: Record<string, unknown>,
  index: number,
  slideID: string,
): EditorOption => ({
  option_id: String(
    option.id ?? option.option_id ?? `legacy-${slideID}-${index}`,
  ),
  text: stringValue(option.text ?? option.option_text),
  is_correct: option.is_correct === true,
  image_url: stringValue(option.image_url),
  order: numberValue(option.order, index + 1),
});

const commonEditorSlide = (slide: SlideDTO) => ({
  slide_id: slide.id,
  revision: numberValue(slide.revision, 1),
  order: slide.position,
  show_leaderboard_after: false,
});

const choiceTransport: EditorTransportRegistration = {
  key: "choice",
  matchesTransport: ({ slide, content }) =>
    slide.kind === "activity" &&
    content.activity_kind === "choice",
  fromTransport: ({ slide, content }) => {
    const prompt = recordValue(content.prompt);
    const response = recordValue(content.response);
    const evaluation = recordValue(content.evaluation);
    const scoring = recordValue(content.scoring);
    const timing = recordValue(content.timing);
    const results = recordValue(content.results);
    const correctOptionIDs = new Set(
      stringArrayValue(evaluation.correct_option_ids),
    );
    const rawOptions = Array.isArray(response.options)
      ? response.options as Record<string, unknown>[]
      : [];
    const selection: QuestionType =
      response.selection === "multiple" ? "multiple" : "single";

    return {
      ...commonEditorSlide(slide),
      slide_type: 1,
      item_kind: "activity",
      activity_kind: "choice",
      schema_version: numberValue(content.schema_version, 1),
      show_leaderboard_after:
        results.show_overall_leaderboard_after === true,
      question: {
        question_id: slide.id,
        title: stringValue(prompt.title),
        text: stringValue(prompt.text),
        question_text: stringValue(prompt.text),
        question_type: selection,
        evaluation_mode:
          evaluation.mode === "none" ? "none" : "correctness",
        scoring_mode:
          scoring.mode === "none" ? "none" : "points",
        time_limit: numberValue(timing.duration_seconds, 10),
        question_time: numberValue(timing.duration_seconds, 10),
        min_point: numberValue(scoring.min_points, 0),
        max_point: numberValue(scoring.max_points, 100),
        image_url: stringValue(prompt.image_url),
        question_image: stringValue(prompt.image_url),
        faster_answers_more_points: scoring.speed_bonus === true,
        partial_scoring:
          selection === "multiple" &&
          scoring.partial_credit === true,
        options: rawOptions.map((option, index) => {
          const normalized = normalizeOption(option, index, slide.id);
          return {
            ...normalized,
            is_correct: correctOptionIDs.has(normalized.option_id),
          };
        }),
      },
    };
  },
};

const contentTransport: EditorTransportRegistration = {
  key: "content",
  matchesTransport: ({ slide }) => slide.kind === "content",
  fromTransport: ({ slide, content }) => ({
    ...commonEditorSlide(slide),
    slide_type: 2,
    item_kind: "content",
    question: null,
    title: stringValue(content.title),
    content_text: stringValue(content.text ?? content.content_text),
    content_image_url: stringValue(
      content.image_url ?? content.content_image_url,
    ),
  }),
};

const choiceDraftTransport: EditorTransportRegistration = {
  key: "choice-draft",
  matchesTransport: ({ slide }) => slide.kind === "question_draft",
  fromTransport: ({ slide, content }) => ({
    ...commonEditorSlide(slide),
    slide_type: 1,
    item_kind: "question-draft",
    show_leaderboard_after:
      content.show_leaderboard_after === true,
    question: null,
  }),
};

// Temporary read compatibility for authored pre-v2 data. New writes never use
// this shape; V2.7 removes the adapter after legacy data is no longer present.
const legacyQuestionTransport: EditorTransportRegistration = {
  key: "legacy-question",
  matchesTransport: ({ slide }) => String(slide.kind) === "question",
  fromTransport: ({ slide, content }) => {
    const rawOptions = Array.isArray(content.options)
      ? content.options as Record<string, unknown>[]
      : [];
    const selection: QuestionType =
      content.question_type === "multiple" ? "multiple" : "single";

    return {
      ...commonEditorSlide(slide),
      slide_type: 1,
      item_kind: "activity",
      activity_kind: "choice",
      schema_version: 1,
      show_leaderboard_after:
        content.show_leaderboard_after === true,
      question: {
        question_id: slide.id,
        title: stringValue(content.title),
        text: stringValue(content.text),
        question_text: stringValue(content.text),
        question_type: selection,
        evaluation_mode: "correctness",
        scoring_mode: "points",
        time_limit: numberValue(content.question_time, 10),
        question_time: numberValue(content.question_time, 10),
        min_point: numberValue(content.min_point, 0),
        max_point: numberValue(content.max_point, 100),
        image_url: stringValue(content.image_url),
        question_image: stringValue(content.image_url),
        faster_answers_more_points:
          content.faster_answers_more_points === true,
        partial_scoring:
          selection === "multiple" &&
          content.partial_scoring === true,
        options: rawOptions.map((option, index) =>
          normalizeOption(option, index, slide.id),
        ),
      },
    };
  },
};

const legacyLeaderboardTransport: EditorTransportRegistration = {
  key: "legacy-leaderboard",
  matchesTransport: ({ slide }) => slide.kind === "leaderboard",
  fromTransport: ({ slide, content }) => ({
    ...commonEditorSlide(slide),
    slide_type: 3,
    item_kind: "legacy-leaderboard",
    question: null,
    title: stringValue(content.title, "Leaderboard"),
  }),
};

const transportRegistry: readonly EditorTransportRegistration[] = [
  choiceTransport,
  contentTransport,
  choiceDraftTransport,
  legacyQuestionTransport,
  legacyLeaderboardTransport,
];

export const editorSlideFromTransport = (
  slide: SlideDTO,
): EditorSlide => {
  const context: TransportContext = {
    slide,
    content: recordValue(slide.content),
  };
  const registration = transportRegistry.find((entry) =>
    entry.matchesTransport(context),
  );

  if (!registration) {
    throw new Error(
      `Unsupported editor item transport kind: ${String(slide.kind)}`,
    );
  }

  return registration.fromTransport(context);
};

export const editorSlideToTransportDefinition = (
  slide: EditorSlide,
  fallbackPosition = 0,
): CreateSlideRequestDTO => {
  const position = numberValue(slide.order, fallbackPosition);

  if (slide.slide_type === 1 && !slide.question) {
    return {
      position,
      kind: "question_draft",
      content: {
        show_leaderboard_after:
          slide.show_leaderboard_after === true,
      },
    };
  }

  const registration = resolveEditorItemRegistration(slide);
  if (!registration) {
    throw new Error("Unsupported editor item definition.");
  }

  if (registration.key === "choice") {
    const question = slide.question;
    if (!question) {
      throw new Error("Choice Activity requires a configured question.");
    }
    return {
      position,
      kind: "activity",
      content: {
        schema_version: 1,
        activity_kind: "choice",
        prompt: {
          title: question.title || "",
          text:
            question.question_text ??
            question.text ??
            "",
          image_url:
            question.question_image ||
            question.image_url ||
            "",
        },
        response: {
          selection: question.question_type,
          options: question.options.map((option, index) => ({
            id: option.option_id,
            text: option.text,
            image_url: option.image_url || "",
            order: index + 1,
          })),
        },
        evaluation: {
          mode:
            question.evaluation_mode === "none"
              ? "none"
              : "correctness",
          correct_option_ids:
            question.evaluation_mode === "none"
              ? []
              : question.options
                  .filter((option) => option.is_correct === true)
                  .map((option) => option.option_id),
        },
        scoring: {
          mode:
            question.scoring_mode === "none"
              ? "none"
              : "points",
          min_points:
            question.scoring_mode === "none"
              ? 0
              : numberValue(question.min_point, 0),
          max_points:
            question.scoring_mode === "none"
              ? 0
              : numberValue(question.max_point, 100),
          speed_bonus:
            question.scoring_mode === "points" &&
            question.faster_answers_more_points === true,
          partial_credit:
            question.scoring_mode === "points" &&
            question.question_type === "multiple" &&
            question.partial_scoring === true,
        },
        timing: {
          duration_seconds: numberValue(
            question.question_time ??
              question.time_limit,
            10,
          ),
        },
        results: {
          show_overall_leaderboard_after:
            question.scoring_mode !== "none" &&
            slide.show_leaderboard_after === true,
        },
      },
    };
  }

  if (registration.key === "content") {
    return {
      position,
      kind: "content",
      content: {
        title: slide.title || "",
        text: slide.content_text || "",
        image_url: slide.content_image_url || "",
      },
    };
  }

  if (registration.key === "legacy-leaderboard") {
    return {
      position,
      kind: "leaderboard",
      content: { title: slide.title || "Leaderboard" },
    };
  }

  throw new Error(
    `Unsupported editor item registration: ${registration.key}`,
  );
};
