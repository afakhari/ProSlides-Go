const PLAYER_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#78716c",
] as const;

const simpleHash = (input: string | number): number => {
  const value = String(input);
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export function getColorForUser(
  userId: string | number | null | undefined,
): string {
  if (userId === null || userId === undefined || userId === "") {
    return PLAYER_COLORS[0];
  }

  return PLAYER_COLORS[simpleHash(userId) % PLAYER_COLORS.length];
}

function getPlayerColor(
  userId: string | number | null | undefined,
  serverColor?: string | null,
): string {
  if (serverColor && serverColor !== "#6366f1") {
    return serverColor;
  }
  return getColorForUser(userId);
}

const normalizeHex = (input: unknown): string | null => {
  if (!input) return null;
  const value = String(input).trim();
  if (!value.startsWith("#")) return null;

  if (value.length === 4) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return /^#[0-9a-f]{6}$/i.test(value) ? value : null;
};

function isLightColor(hex: unknown): boolean {
  const normalized = normalizeHex(hex);
  if (!normalized) return false;

  const channels = [1, 3, 5].map((start) =>
    Number.parseInt(normalized.slice(start, start + 2), 16),
  );
  if (channels.some((value) => Number.isNaN(value))) return false;

  const srgb = channels.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  const luminance =
    0.2126 * srgb[0] +
    0.7152 * srgb[1] +
    0.0722 * srgb[2];

  return luminance > 0.6;
}
