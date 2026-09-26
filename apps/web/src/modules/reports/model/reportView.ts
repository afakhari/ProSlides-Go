import type {
  ReportActivityPage,
  ReportActivityResponse,
  ReportActivitySummary,
  ReportSessionSummary,
} from "../api/reportApi.ts";

type ChoiceOption = {
  id: string;
  text?: string;
  order?: number;
};

type ActivityDefinitionView = {
  activity_kind?: string;
  prompt?: {
    title?: string;
    text?: string;
  };
  response?: {
    options?: ChoiceOption[];
  };
  evaluation?: {
    mode?: string;
    correct_option_ids?: string[];
  };
  scoring?: {
    mode?: string;
  };
  results?: {
    aggregation?: string;
  };
};

type ChoiceResponse = {
  selected_option_indexes?: number[];
};

type TextResponse = {
  text?: string;
  terms?: string[];
};

type ChoiceResultPayload = {
  option_counts?: Record<string, number>;
};

type WordFrequencyTermView = {
  text: string;
  count: number;
};

type WordFrequencyResultPayload = {
  terms?: WordFrequencyTermView[];
};

const asActivityDefinition = (
  activity: ReportActivitySummary,
): ActivityDefinitionView =>
  activity.definition as ActivityDefinitionView;

export const activityTitle = (activity: ReportActivitySummary): string => {
  const definition = asActivityDefinition(activity);
  return (
    definition.prompt?.title?.trim() ||
    definition.prompt?.text?.trim() ||
    `فعالیت ${activity.position + 1}`
  );
};

export const activityPrompt = (activity: ReportActivitySummary): string => {
  const definition = asActivityDefinition(activity);
  return definition.prompt?.text?.trim() || "";
};

export const isPollActivity = (
  activity: ReportActivitySummary,
): boolean => {
  const definition = asActivityDefinition(activity);
  return (
    definition.activity_kind === "choice" &&
    definition.evaluation?.mode === "none" &&
    definition.scoring?.mode === "none"
  );
};

export const isWordCloudActivity = (
  activity: ReportActivitySummary,
): boolean => {
  const definition = asActivityDefinition(activity);
  return (
    definition.activity_kind === "text" &&
    definition.results?.aggregation === "word_frequency"
  );
};

const frozenChoiceOptions = (
  activity: ReportActivitySummary,
): ChoiceOption[] =>
  asActivityDefinition(activity).activity_kind === "choice"
    ? asActivityDefinition(activity).response?.options ?? []
    : [];

export const choiceOptions = (
  activity: ReportActivitySummary,
): ChoiceOption[] =>
  [...frozenChoiceOptions(activity)].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0),
  );

export const choiceResultCounts = (
  page: ReportActivityPage,
): Record<string, number> => {
  if (page.result.activity_kind !== "choice") return {};
  const payload = page.result.payload as ChoiceResultPayload;
  return payload.option_counts ?? {};
};

export const wordCloudTerms = (
  page: ReportActivityPage,
): WordFrequencyTermView[] => {
  if (page.result.activity_kind !== "text") return [];
  const payload = page.result.payload as WordFrequencyResultPayload;
  return (payload.terms ?? []).filter(
    (term) =>
      Boolean(term?.text?.trim()) &&
      Number.isFinite(Number(term.count)) &&
      Number(term.count) > 0,
  );
};

export const responseLabels = (
  activity: ReportActivitySummary,
  response: ReportActivityResponse,
): string[] => {
  const definition = asActivityDefinition(activity);
  if (definition.activity_kind === "text") {
    const payload = response.response as TextResponse;
    const text = payload.text?.trim();
    return text ? [text] : [];
  }

  // Accepted Choice indexes refer to the frozen array positions used by the
  // live runtime. Display ordering must never be applied before index lookup.
  const options = frozenChoiceOptions(activity);
  const payload = response.response as ChoiceResponse;
  const selected = payload.selected_option_indexes ?? [];
  return selected
    .map((index) => options[index]?.text?.trim() || options[index]?.id)
    .filter((value): value is string => Boolean(value));
};

export const formatReportDateTime = (value: string | null | undefined) => {
  if (!value) return "نامشخص";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "نامشخص";
  return date.toLocaleString("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const sessionStateLabel = (
  state: ReportSessionSummary["state"],
): string =>
  ({
    draft: "پیش‌نویس",
    lobby: "در انتظار شروع",
    presenting: "در حال اجرا",
    ended: "پایان‌یافته",
  })[state];

const sessionTimeLabel = (session: ReportSessionSummary): string =>
  session.ended_at
    ? `پایان: ${formatReportDateTime(session.ended_at)}`
    : `شروع: ${formatReportDateTime(session.created_at)}`;
