import type {
  ReportActivityResponse,
  ReportActivitySummary,
  ReportSessionSummary,
} from "../api/reportApi.ts";

type ChoiceOption = {
  id: string;
  text?: string;
  order?: number;
};

type ChoiceDefinition = {
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
};

type ChoiceResponse = {
  selected_option_indexes?: number[];
};

const asChoiceDefinition = (
  activity: ReportActivitySummary,
): ChoiceDefinition => activity.definition as ChoiceDefinition;

export const activityTitle = (activity: ReportActivitySummary): string => {
  const definition = asChoiceDefinition(activity);
  return (
    definition.prompt?.title?.trim() ||
    definition.prompt?.text?.trim() ||
    `فعالیت ${activity.position + 1}`
  );
};

export const activityPrompt = (activity: ReportActivitySummary): string => {
  const definition = asChoiceDefinition(activity);
  return definition.prompt?.text?.trim() || "";
};

const frozenChoiceOptions = (
  activity: ReportActivitySummary,
): ChoiceOption[] => asChoiceDefinition(activity).response?.options ?? [];

export const choiceOptions = (
  activity: ReportActivitySummary,
): ChoiceOption[] =>
  [...frozenChoiceOptions(activity)].sort(
    (left, right) => (left.order ?? 0) - (right.order ?? 0),
  );

export const responseLabels = (
  activity: ReportActivitySummary,
  response: ReportActivityResponse,
): string[] => {
  // Accepted response indexes refer to the frozen array positions used by the
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

export const sessionTimeLabel = (session: ReportSessionSummary): string =>
  session.ended_at
    ? `پایان: ${formatReportDateTime(session.ended_at)}`
    : `شروع: ${formatReportDateTime(session.created_at)}`;
