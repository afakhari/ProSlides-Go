import type { EditorOption, EditorPresentation, EditorQuestion, EditorSlide, QuestionType } from "../editor/domain";
import { ApiError, requestJson, type ApiRequestOptions } from "../shared/api/http.ts";
import type { components } from "../shared/api/generated/openapi.ts";

type SlideDTO = components["schemas"]["Slide"];
type PresentationDTO = components["schemas"]["Presentation"];
type PresentationSummaryDTO = components["schemas"]["PresentationSummary"];
type AccessCodeResultDTO = components["schemas"]["AccessCodeResult"];

export { ApiError as QuizServiceError } from "../shared/api/http.ts";

type RequestOptions = ApiRequestOptions;
const request = requestJson;

const revisionHeaders = (revision?: number): Record<string, string> =>
  Number.isInteger(revision) && Number(revision) > 0 ? { "If-Match": String(revision) } : {};

const stringValue = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const numberValue = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeOption = (option: Record<string, unknown>, index: number, slideID: string): EditorOption => ({
  option_id: String(option.id ?? option.option_id ?? `legacy-${slideID}-${index}`),
  text: stringValue(option.text ?? option.option_text),
  is_correct: option.is_correct === true,
  image_url: stringValue(option.image_url),
  order: numberValue(option.order, index + 1),
});

export const slideToEditor = (slide: SlideDTO): EditorSlide => {
  const content = slide.content || {};
  const common = {
    slide_id: slide.id,
    revision: numberValue(slide.revision, 1),
    order: slide.position,
    show_leaderboard_after: content.show_leaderboard_after === true,
  };
  if (slide.kind === "question") {
    const rawOptions = Array.isArray(content.options) ? content.options as Record<string, unknown>[] : [];
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
      partial_scoring: content.question_type === "multiple" && content.partial_scoring === true,
      options: rawOptions.map((option, index) => normalizeOption(option, index, slide.id)),
    };
    return { ...common, slide_type: 1, question };
  }
  if (slide.kind === "question_draft") return { ...common, slide_type: 1, question: null };
  if (slide.kind === "leaderboard") {
    return { ...common, slide_type: 3, question: null, title: stringValue(content.title, "Leaderboard") };
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

export const editorSlideToDefinition = (slide: EditorSlide, fallbackPosition = 0) => {
  const position = numberValue(slide.order, fallbackPosition);
  if (slide.slide_type === 1 && !slide.question) {
    return { position, kind: "question_draft", content: { show_leaderboard_after: slide.show_leaderboard_after === true } };
  }
  if (slide.slide_type === 1 && slide.question) {
    const question = slide.question;
    return {
      position,
      kind: "question",
      content: {
        title: question.title || "",
        text: question.question_text ?? question.text ?? "",
        question_type: question.question_type,
        question_time: numberValue(question.question_time ?? question.time_limit, 10),
        min_point: numberValue(question.min_point, 0),
        max_point: numberValue(question.max_point, 100),
        image_url: question.question_image || question.image_url || "",
        faster_answers_more_points: question.faster_answers_more_points === true,
        partial_scoring: question.question_type === "multiple" && question.partial_scoring === true,
        show_leaderboard_after: slide.show_leaderboard_after === true,
        options: question.options.map((option, index) => ({
          id: option.option_id,
          text: option.text,
          is_correct: option.is_correct === true,
          image_url: option.image_url || "",
          order: index + 1,
        })),
      },
    };
  }
  if (slide.slide_type === 3) {
    return { position, kind: "leaderboard", content: { title: slide.title || "Leaderboard" } };
  }
  return {
    position,
    kind: "content",
    content: { title: slide.title || "", text: slide.content_text || "", image_url: slide.content_image_url || "" },
  };
};

const mutationQueues = new Map<string, Promise<unknown>>();
const queueSlideMutation = <T>(presentationID: string, slideID: string, mutation: () => Promise<T>): Promise<T> => {
  const key = `${presentationID}:${slideID}`;
  const previous = mutationQueues.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(mutation);
  const tracked = next.finally(() => {
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
  getEditorQuiz: async (quizID: string) => presentationToEditor(await request<PresentationDTO>(`/presentations/${quizID}`)),
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

  getQuestionResults: async (quizID: string, slideID: string, limit = 100) => {
    try {
      const locator = await request<{ session_id: string }>(`/presentations/${quizID}/latest-session`);
      return await request<Record<string, unknown>>(`/presentations/${quizID}/sessions/${locator.session_id}/questions/${slideID}/results?limit=${limit}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  getQuestionLeaderboard: async (quizID: string, slideID: string) => {
    const page = await quizService.getQuestionResults(quizID, slideID, 100) as { leaderboard?: Array<Record<string, unknown>> } | null;
    return (page?.leaderboard || []).map((item) => ({
      rust_session_id: item.participant_id,
      player_name: item.display_name,
      avatar: item.avatar || "",
      score: Number(item.score || 0),
      rank: Number(item.rank || 0),
      time_taken: item.time_taken_ms == null ? null : Number(item.time_taken_ms) / 1000,
    }));
  },
  getSlidesFromAPI: (quizID: string) => quizService.getQuiz(quizID),
  deleteLeaderboardSlide: (quizID: string, slide: EditorSlide) => quizService.updateSlide(quizID, slide.slide_id, { ...slide, show_leaderboard_after: false }),
};

export type { EditorPresentation, EditorQuestion, EditorSlide, QuestionType };
