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

