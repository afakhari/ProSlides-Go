import type { EditorOption, EditorPresentation, EditorQuestion, EditorSlide, QuestionType } from "../model/editor.ts";
import { ApiError, requestJson, type ApiRequestOptions } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";

type SlideDTO = components["schemas"]["Slide"];
type PresentationDTO = components["schemas"]["Presentation"];
type PresentationSummaryDTO = components["schemas"]["PresentationSummary"];
type AccessCodeResultDTO = components["schemas"]["AccessCodeResult"];
type CreateSlideRequestDTO = components["schemas"]["CreateSlideRequest"];

export { ApiError as QuizServiceError } from "../../../shared/api/http.ts";

type RequestOptions = ApiRequestOptions;
const request = requestJson;

const revisionHeaders = (revision?: number): Record<string, string> =>
  Number.isInteger(revision) && Number(revision) > 0 ? { "If-Match": String(revision) } : {};

const stringValue = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const numberValue = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const recordValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
const stringArrayValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const normalizeOption = (option: Record<string, unknown>, index: number, slideID: string): EditorOption => ({
  option_id: String(option.id ?? option.option_id ?? `legacy-${slideID}-${index}`),
  text: stringValue(option.text ?? option.option_text),
  is_correct: option.is_correct === true,
  image_url: stringValue(option.image_url),
  order: numberValue(option.order, index + 1),
});

export const slideToEditor = (slide: SlideDTO): EditorSlide => {
  const content = recordValue(slide.content);
  const kind = String(slide.kind);
  const common = {
    slide_id: slide.id,
    revision: numberValue(slide.revision, 1),
    order: slide.position,
    show_leaderboard_after: content.show_leaderboard_after === true,
  };

  if (kind === "activity" && content.activity_kind === "choice") {
    const prompt = recordValue(content.prompt);
    const response = recordValue(content.response);
    const evaluation = recordValue(content.evaluation);
    const scoring = recordValue(content.scoring);
    const timing = recordValue(content.timing);
    const results = recordValue(content.results);
    const correctOptionIDs = new Set(stringArrayValue(evaluation.correct_option_ids));
    const rawOptions = Array.isArray(response.options)
      ? response.options as Record<string, unknown>[]
      : [];
    const selection: QuestionType =
      response.selection === "multiple" ? "multiple" : "single";
    const question: EditorQuestion = {
      question_id: slide.id,
      title: stringValue(prompt.title),
      text: stringValue(prompt.text),
      question_text: stringValue(prompt.text),
      question_type: selection,
      time_limit: numberValue(timing.duration_seconds, 10),
      question_time: numberValue(timing.duration_seconds, 10),
      min_point: numberValue(scoring.min_points, 0),
      max_point: numberValue(scoring.max_points, 100),
      image_url: stringValue(prompt.image_url),
      question_image: stringValue(prompt.image_url),
      faster_answers_more_points: scoring.speed_bonus === true,
      partial_scoring:
        selection === "multiple" && scoring.partial_credit === true,
      options: rawOptions.map((option, index) => {
        const normalized = normalizeOption(option, index, slide.id);
        return {
          ...normalized,
          is_correct: correctOptionIDs.has(normalized.option_id),
        };
      }),
    };
    return {
      ...common,
      slide_type: 1,
      show_leaderboard_after:
        results.show_overall_leaderboard_after === true,
      question,
    };
  }

  // Temporary read compatibility for a pre-migration payload. The API no
  // longer persists new authored questions in this shape.
  if (kind === "question") {
    const rawOptions = Array.isArray(content.options)
      ? content.options as Record<string, unknown>[]
      : [];
    const question: EditorQuestion = {
      question_id: slide.id,
      title: stringValue(content.title),
      text: stringValue(content.text),
      question_text: stringValue(content.text),
      question_type: content.question_type === "multiple" ? "multiple" : "single",
      time_limit: numberValue(content.question_time, 10),
      question_time: numberValue(content.question_time, 10),
      min_point: numberValue(content.min_point, 0),
      max_point: numberValue(content.max_point, 100),
      image_url: stringValue(content.image_url),
      question_image: stringValue(content.image_url),
      faster_answers_more_points: content.faster_answers_more_points === true,
      partial_scoring:
        content.question_type === "multiple" &&
        content.partial_scoring === true,
      options: rawOptions.map((option, index) =>
        normalizeOption(option, index, slide.id),
      ),
    };
    return { ...common, slide_type: 1, question };
  }

  if (kind === "question_draft") {
    return { ...common, slide_type: 1, question: null };
  }
  if (kind === "leaderboard") {
    return {
      ...common,
      slide_type: 3,
      question: null,
      title: stringValue(content.title, "Leaderboard"),
    };
  }
  return {
    ...common,
    slide_type: 2,
    question: null,
    title: stringValue(content.title),
    content_text: stringValue(content.text ?? content.content_text),
    content_image_url: stringValue(content.image_url ?? content.content_image_url),
  };
};

export const presentationToEditor = (presentation: PresentationDTO): EditorPresentation => {
  const settings = presentation.settings || {};
  const backgroundColor = stringValue(settings.background_color, "#f7f7fb");
  const backgroundImage = stringValue(settings.background_image_url);
  const textColor = stringValue(settings.text_color, "#111827");
  return {
    quiz_id: presentation.id,
    revision: numberValue(presentation.revision, 1),
    access_code: stringValue(presentation.access_code),
    title: presentation.title,
    quiz_name: presentation.title,
    background_color: backgroundColor,
    background_image_url: backgroundImage,
    text_color: textColor,
    music_url: stringValue(settings.music_url),
    background: { color: backgroundColor, image: backgroundImage, text_color: textColor },
    slides: (presentation.slides || []).map(slideToEditor),
    created_at: presentation.created_at,
    last_update: presentation.updated_at,
  };
};

export const editorSlideToDefinition = (
  slide: EditorSlide,
  fallbackPosition = 0,
): CreateSlideRequestDTO => {
  const position = numberValue(slide.order, fallbackPosition);
  if (slide.slide_type === 1 && !slide.question) {
    return {
      position,
      kind: "question_draft",
      content: {
        show_leaderboard_after: slide.show_leaderboard_after === true,
      },
    };
  }

  if (slide.slide_type === 1 && slide.question) {
    const question = slide.question;
    return {
      position,
      kind: "activity",
      content: {
        schema_version: 1,
        activity_kind: "choice",
        prompt: {
          title: question.title || "",
          text: question.question_text ?? question.text ?? "",
          image_url: question.question_image || question.image_url || "",
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
          mode: "correctness",
          correct_option_ids: question.options
            .filter((option) => option.is_correct === true)
            .map((option) => option.option_id),
        },
        scoring: {
          mode: "points",
          min_points: numberValue(question.min_point, 0),
          max_points: numberValue(question.max_point, 100),
          speed_bonus: question.faster_answers_more_points === true,
          partial_credit:
            question.question_type === "multiple" &&
            question.partial_scoring === true,
        },
        timing: {
          duration_seconds: numberValue(
            question.question_time ?? question.time_limit,
            10,
          ),
        },
        results: {
          show_overall_leaderboard_after:
            slide.show_leaderboard_after === true,
        },
      },
    };
  }

  if (slide.slide_type === 3) {
    return {
      position,
      kind: "leaderboard",
      content: { title: slide.title || "Leaderboard" },
    };
  }

  return {
    position,
    kind: "content",
    content: {
      title: slide.title || "",
      text: slide.content_text || "",
      image_url: slide.content_image_url || "",
    },
  };
};

const mutationQueues = new Map<string, Promise<void>>();
const queueSlideMutation = <T>(presentationID: string, slideID: string, mutation: () => Promise<T>): Promise<T> => {
  const key = `${presentationID}:${slideID}`;
  const previous = mutationQueues.get(key) || Promise.resolve();
  const next = previous.then(mutation, mutation);
  const tracked = next.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
    if (mutationQueues.get(key) === tracked) mutationQueues.delete(key);
  });
  mutationQueues.set(key, tracked);
  return next;
};

type PresentationUpdate = Partial<Pick<EditorPresentation, "title" | "quiz_name" | "background_color" | "background_image_url" | "text_color" | "music_url">> & {
  revision?: number;
  background?: Partial<EditorPresentation["background"]>;
};

const updatePresentation = async (quizID: string, data: PresentationUpdate): Promise<EditorPresentation> => {
  const settings: Record<string, unknown> = {};
  if (data.background_color !== undefined || data.background?.color !== undefined) settings.background_color = data.background_color ?? data.background?.color;
  if (data.background_image_url !== undefined || data.background?.image !== undefined) settings.background_image_url = data.background_image_url ?? data.background?.image;
  if (data.text_color !== undefined || data.background?.text_color !== undefined) settings.text_color = data.text_color ?? data.background?.text_color;
  if (data.music_url !== undefined) settings.music_url = data.music_url;
  const json: Record<string, unknown> = {};
  const title = data.title ?? data.quiz_name;
  if (title !== undefined) json.title = title;
  if (Object.keys(settings).length) json.settings = settings;
  if (!Object.keys(json).length) return quizService.getEditorQuiz(quizID);
  const response = await request<PresentationDTO>(`/presentations/${quizID}`, {
    method: "PATCH",
    headers: revisionHeaders(data.revision),
    json,
  });
  return presentationToEditor(response);
};

export const quizService = {
  listPresentations: (options?: RequestOptions) => request<PresentationSummaryDTO[]>("/presentations", options),
  createPresentation: (title = "Untitled Presentation") => request<PresentationDTO>("/presentations", { method: "POST", json: { title, settings: {} } }),
  deletePresentation: (id: string) => request<void>(`/presentations/${id}`, { method: "DELETE" }),
  duplicatePresentation: (id: string, title: string) => request<PresentationDTO>(`/presentations/${id}/duplicate`, { method: "POST", json: { title } }),
  resetPresentationResults: (id: string) => request<void>(`/presentations/${id}/results`, { method: "DELETE" }),
  getLatestSession: (id: string, options?: RequestOptions) => request<Record<string, unknown>>(`/presentations/${id}/latest-session`, options),

  getQuiz: async (quizID: string, options?: RequestOptions) => presentationToEditor(await request<PresentationDTO>(`/presentations/${quizID}`, options)),
  getEditorQuiz: async (quizID: string, options?: RequestOptions) =>
    presentationToEditor(
      await request<PresentationDTO>(`/presentations/${quizID}`, options),
    ),
  updateQuiz: updatePresentation,
  updateQuizMusic: (quizID: string, musicURL: string, revision?: number) => updatePresentation(quizID, { music_url: musicURL || "", revision }),
  updateQuizBackground: (quizID: string, data: PresentationUpdate, revision?: number) => updatePresentation(quizID, { ...data, revision: revision ?? data.revision }),
  setAccessCode: (quizID: string, accessCode: string) => request<AccessCodeResultDTO>(`/presentations/${quizID}/access-code`, {
    method: "PUT",
    json: { access_code: accessCode },
  }),

  createSlide: async (quizID: string, slide: EditorSlide, presentationRevision?: number) => slideToEditor(await request<SlideDTO>(`/presentations/${quizID}/slides`, {
    method: "POST",
    headers: revisionHeaders(presentationRevision),
    json: editorSlideToDefinition(slide, slide.order),
  })),
  updateSlide: (quizID: string, slideID: string, slide: EditorSlide) => queueSlideMutation(quizID, slideID, async () =>
    slideToEditor(await request<SlideDTO>(`/presentations/${quizID}/slides/${slideID}`, {
      method: "PUT",
      headers: revisionHeaders(slide.revision),
      json: editorSlideToDefinition(slide, slide.order),
    }))),
  deleteSlide: (quizID: string, slideID: string, revision?: number) => request<void>(`/presentations/${quizID}/slides/${slideID}`, {
    method: "DELETE",
    headers: revisionHeaders(revision),
  }),
  reorderSlides: (quizID: string, slideIDs: string[], revision?: number) => request<void>(`/presentations/${quizID}/slides/reorder`, {
    method: "POST",
    headers: revisionHeaders(revision),
    json: { slide_ids: slideIDs.map(String) },
  }),

  getSlidesFromAPI: (quizID: string) => quizService.getQuiz(quizID),
};

export type { EditorPresentation, EditorQuestion, EditorSlide, QuestionType };
