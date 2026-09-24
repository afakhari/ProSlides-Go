import type { components } from "../../../../shared/api/generated/openapi.ts";
import { normalizeDigits } from "../../../../shared/forms/numbers.ts";

type PresentationSummaryDTO = components["schemas"]["PresentationSummary"];
type PresentationSummaryWithLegacyOwner = PresentationSummaryDTO & {
  owner_full_name?: string | null;
  owner_name?: string | null;
};

export interface DashboardQuiz {
  id: string;
  revision: number;
  name: string;
  accessCode: string;
  slides: number;
  participants: number;
  createdBy: string;
  lastUpdated: string;
  created: string;
  updatedAt: number;
  createdAt: number;
}

export interface VersionInfo {
  baseName: string;
  version: number;
}

export const safeTimestamp = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  const text = String(value ?? "").trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    if (Number.isFinite(numeric)) {
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    }
  }

  const time = Date.parse(text);
  return Number.isNaN(time) ? 0 : time;
};

export const formatDate = (timestamp: unknown): string => {
  const time = safeTimestamp(timestamp);
  return time
    ? new Date(time).toLocaleDateString("fa-IR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";
};

const persianNumberFormatter = new Intl.NumberFormat("fa-IR");

export const formatNumber = (value: unknown): string =>
  persianNumberFormatter.format(
    Number.isFinite(Number(value)) ? Number(value) : 0,
  );

export const normalizePersianText = (value: unknown = ""): string =>
  normalizeDigits(String(value).normalize("NFKC"))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌\s]+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");

export const persianCollator = new Intl.Collator("fa-IR", {
  numeric: true,
  sensitivity: "base",
});

const versionPattern = /\s*-\s*نسخه\s+([0-9۰-۹٠-٩]+)$/u;

export const getVersionInfo = (title: unknown): VersionInfo => {
  const value = String(title ?? "").trim();
  const match = value.match(versionPattern);
  if (!match) {
    return { baseName: value || "ارائه بدون عنوان", version: 1 };
  }

  const version = Number(normalizeDigits(match[1])) || 1;
  const baseName = value.slice(0, match.index).trim() || "ارائه بدون عنوان";
  return { baseName, version };
};

export const formatVersionTitle = (baseName: unknown, version: unknown): string =>
  `${String(baseName ?? "").trim() || "ارائه بدون عنوان"} - نسخه ${formatNumber(version)}`;

export const localizeSystemTitle = (title: unknown): string => {
  const value = String(title ?? "").trim();
  if (!value || value === "Untitled Presentation") return "ارائه بدون عنوان";

  const untitledCopyMatch = value.match(/^Untitled Presentation \(copy (\d+)\)$/i);
  if (untitledCopyMatch) {
    return formatVersionTitle(
      "ارائه بدون عنوان",
      Number(untitledCopyMatch[1]) + 1,
    );
  }

  if (versionPattern.test(value)) {
    const { baseName, version } = getVersionInfo(value);
    return formatVersionTitle(baseName, version);
  }

  return value;
};

export const getDuplicateTitle = (
  quiz: Pick<DashboardQuiz, "name">,
  allQuizzes: Array<Pick<DashboardQuiz, "name">>,
): string => {
  const current = getVersionInfo(quiz.name);
  const normalizedBaseName = normalizePersianText(current.baseName);
  let maxVersion = current.version;

  for (const item of allQuizzes) {
    const itemInfo = getVersionInfo(item.name);
    if (normalizePersianText(itemInfo.baseName) === normalizedBaseName) {
      maxVersion = Math.max(maxVersion, itemInfo.version);
    }
  }

  return formatVersionTitle(current.baseName, maxVersion + 1);
};

const hasPersianText = (value: unknown): boolean =>
  /[\u0600-\u06FF]/u.test(String(value ?? ""));

export const toPersianUiMessage = (value: unknown, fallback: string): string => {
  const text = String(value ?? "").trim();
  return text && hasPersianText(text) ? text : fallback;
};

export const toDashboardQuiz = (
  quiz: PresentationSummaryWithLegacyOwner,
  loggedInUser: string,
): DashboardQuiz => {
  const updatedAt = safeTimestamp(quiz.updated_at);
  const createdAt = safeTimestamp(quiz.created_at);
  const owner = String(
    quiz.owner_full_name ?? quiz.owner_name ?? loggedInUser,
  ).trim();

  return {
    id: quiz.id,
    revision: Number(quiz.revision || 1),
    name: localizeSystemTitle(quiz.title),
    accessCode: quiz.access_code || "",
    slides: Number(quiz.slide_count) || 0,
    participants: Number(quiz.participant_count) || 0,
    createdBy: owner || loggedInUser,
    lastUpdated: formatDate(updatedAt),
    created: formatDate(createdAt),
    updatedAt,
    createdAt,
  };
};
