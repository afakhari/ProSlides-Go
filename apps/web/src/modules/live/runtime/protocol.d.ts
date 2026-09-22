import type {
  LiveEvent,
  LiveSnapshot,
  LiveState,
  PresentationSlide,
  RosterEntry,
} from "../api/types";

export interface LiveCursor {
  eventId: number;
  stateVersion: number;
}

export function shouldApplyLiveEvent(
  cursor: LiveCursor,
  event: LiveEvent,
): boolean;

export function advanceLiveCursor(
  cursor: LiveCursor,
  event: LiveEvent,
): LiveCursor;

export function liveCursorFromSnapshot(snapshot: LiveSnapshot): LiveCursor;

export function planLiveNavigation(
  state: LiveState | undefined,
  command: string,
  slide?: unknown,
): string[];

export function planLiveEnd(state: LiveState | undefined): string[];

export function normalizeLiveSlide(
  activeSlide: unknown,
  session?: Record<string, unknown>,
): Record<string, unknown> | null;

export function rosterEntryToLegacy(
  entry: RosterEntry,
  index?: number,
): Record<string, unknown>;

export function participantToLegacy(
  participant: Record<string, unknown>,
): Record<string, unknown>;

export function presentationSlideToLegacy(
  slide: PresentationSlide,
): Record<string, unknown> | null;

export function projectLiveSnapshot(
  snapshot: LiveSnapshot | null | undefined,
  roster?: RosterEntry[],
): Record<string, unknown> | null;
