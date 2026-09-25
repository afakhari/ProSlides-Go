import type {
  EditorPresentation,
  EditorQuestion,
  EditorSlide,
  QuestionType,
} from "../model/editor.ts";
import { requestJson, type ApiRequestOptions } from "../../../shared/api/http.ts";
import type { components } from "../../../shared/api/generated/openapi.ts";
import {
  editorSlideFromTransport,
  editorSlideToTransportDefinition,
} from "./editorItemTransportRegistry.ts";

export {
  editorSlideFromTransport as slideToEditor,
  editorSlideToTransportDefinition as editorSlideToDefinition,
} from "./editorItemTransportRegistry.ts";

type SlideDTO = components["schemas"]["Slide"];
type PresentationDTO = components["schemas"]["Presentation"];
type PresentationSummaryDTO = components["schemas"]["PresentationSummary"];
type AccessCodeResultDTO = components["schemas"]["AccessCodeResult"];

export { ApiError as QuizServiceError } from "../../../shared/api/http.ts";

type RequestOptions = ApiRequestOptions;
const request = requestJson;

const revisionHeaders = (revision?: number): Record<string, string> =>
  Number.isInteger(revision) && Number(revision) > 0 ? { "If-Match": String(revision) } : {};

const numberValue = (value: unknown, fallback: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const presentationToEditor = (presentation: PresentationDTO): EditorPresentation => {
  const settings = presentation.settings || {};
  const backgroundColor =
    typeof settings.background_color === "string"
      ? settings.background_color
      : "#f7f7fb";
  const backgroundImage =
    typeof settings.background_image_url === "string"
      ? settings.background_image_url
      : "";
  const textColor =
    typeof settings.text_color === "string"
      ? settings.text_color
      : "#111827";
  const musicURL =
    typeof settings.music_url === "string"
      ? settings.music_url
      : "";

  return {
    quiz_id: presentation.id,
    revision: numberValue(presentation.revision, 1),
    access_code:
      typeof presentation.access_code === "string"
        ? presentation.access_code
        : "",
    title: presentation.title,
    quiz_name: presentation.title,
    background_color: backgroundColor,
    background_image_url: backgroundImage,
    text_color: textColor,
    music_url: musicURL,
    background: {
      color: backgroundColor,
      image: backgroundImage,
      text_color: textColor,
    },
    slides: (presentation.slides || []).map(editorSlideFromTransport),
    created_at: presentation.created_at,
    last_update: presentation.updated_at,
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

  createSlide: async (quizID: string, slide: EditorSlide, presentationRevision?: number) => editorSlideFromTransport(await request<SlideDTO>(`/presentations/${quizID}/slides`, {
    method: "POST",
    headers: revisionHeaders(presentationRevision),
    json: editorSlideToTransportDefinition(slide, slide.order),
  })),
  updateSlide: (quizID: string, slideID: string, slide: EditorSlide) => queueSlideMutation(quizID, slideID, async () =>
    editorSlideFromTransport(await request<SlideDTO>(`/presentations/${quizID}/slides/${slideID}`, {
      method: "PUT",
      headers: revisionHeaders(slide.revision),
      json: editorSlideToTransportDefinition(slide, slide.order),
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
