export const EMPTY_ROSTER = Object.freeze({ type: 1, Users: [] });

export const USER_COLORS = Object.freeze([
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#EC7063",
]);

export const EMPTY_FOOTER_STATS = Object.freeze({
  hearts: 0,
  happy: 0,
  star: 0,
  thumbsUp: 0,
  players: { current: 0, max: 0 },
});

// These controls are visual-only until their live commands have contracts.
export const FOOTER_CHAT_MESSAGES = Object.freeze([]);
export const FOOTER_MENU_ITEMS = Object.freeze([]);
export const FOOTER_REACTIONS = Object.freeze([]);
