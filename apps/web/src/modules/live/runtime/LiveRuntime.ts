import {
  LiveAPIError,
  applyLiveAction,
  createLiveSession,
  createRequestId,
  getLiveSnapshot,
  getRosterPage,
  joinLiveSession,
  streamLiveEvents,
  submitLiveAnswer,
} from "../api/liveApi.ts";
import type {
  LiveEvent,
  LiveSnapshot,
  ParticipantResult,
  ActivityResult,
  RosterEntry,
  RosterPage,
} from "../api/types.ts";
import {
  advanceLiveCursor,
  liveCursorFromSnapshot,
  planLiveEnd,
  planLiveNavigation,
  shouldApplyLiveEvent,
  type LiveActionName,
  type LiveCursor,
  type LiveNavigationCommand,
  type LiveNavigationSlide,
} from "./protocol.ts";

export type LiveClientRole = "manager" | "player";
export type RosterOrder = "joined" | "score";

export interface LiveJoinResult {
  clientUserId: string;
  participantId: string;
  displayName: string;
  avatar: string;
}

export interface LiveRuntimeState {
  isConnected: boolean;
  connectionError: string | null;
  sessionId: string | null;
  snapshot: LiveSnapshot | null;
  lastJoinResult: LiveJoinResult | null;
  roster: RosterEntry[];
  rosterOrder: RosterOrder;
  hasMoreRoster: boolean;
  isRosterLoading: boolean;
}

export type LiveCommandSlide = LiveNavigationSlide;

export interface LiveAnswerInput {
  request_id?: string;
  question_id: string | number;
  selected_option_indexes: number[];
}

interface RuntimeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface LiveRuntimeTransport {
  createLiveSession: typeof createLiveSession;
  getLiveSnapshot: typeof getLiveSnapshot;
  getRosterPage: typeof getRosterPage;
  joinLiveSession: typeof joinLiveSession;
  submitLiveAnswer: typeof submitLiveAnswer;
  applyLiveAction: typeof applyLiveAction;
  streamLiveEvents: typeof streamLiveEvents;
  createRequestId: typeof createRequestId;
}

export interface LiveRuntimeDependencies {
  transport?: Partial<LiveRuntimeTransport>;
  storage?: RuntimeStorage | null;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  random?: () => number;
}

type Listener = () => void;
const INITIAL_CURSOR: LiveCursor = { eventId: 0, stateVersion: 0 };

const initialState = (): LiveRuntimeState => ({
  isConnected: false,
  connectionError: null,
  sessionId: null,
  snapshot: null,
  lastJoinResult: null,
  roster: [],
  rosterOrder: "joined",
  hasMoreRoster: false,
  isRosterLoading: false,
});

const defaultSleep = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const defaultStorage = (): RuntimeStorage | null => {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "live_runtime_error";

const recordPayload = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const normalizeActivityResult = (payload: unknown): ActivityResult | null => {
  const raw = recordPayload(payload);
  const activityItemId = raw.activity_item_id;
  const rawCounts = recordPayload(raw.option_counts);
  if (activityItemId == null) return null;

  const optionCounts = Object.fromEntries(
    Object.entries(rawCounts).map(([key, value]) => [key, Number(value || 0)]),
  );
  const responseCount = Number(
    raw.response_count ??
      Object.values(optionCounts).reduce((total, value) => total + value, 0),
  );

  return {
    activity_item_id: String(activityItemId),
    response_count: Number.isFinite(responseCount) ? responseCount : 0,
    option_counts: optionCounts,
  };
};

export class LiveRuntime {
  private readonly role: LiveClientRole;
  private readonly transport: LiveRuntimeTransport;
  private readonly storage: RuntimeStorage | null;
  private readonly sleep: LiveRuntimeDependencies["sleep"];
  private readonly random: () => number;
  private listeners = new Set<Listener>();
  private state: LiveRuntimeState = initialState();

  private selectedSessionId: string | null = null;
  private snapshotValue: LiveSnapshot | null = null;
  private cursor: LiveCursor = { ...INITIAL_CURSOR };
  private rosterCursor = "";
  private rosterOrderValue: RosterOrder = "joined";
  private rosterValue: RosterEntry[] = [];
  private streamAbort: AbortController | null = null;
  private refreshPromise: Promise<LiveSnapshot> | null = null;
  private refreshDirty = false;
  private commandInFlight = false;
  private pendingActionIds = new Map<string, string>();
  private lifecycleVersion = 0;
  private rosterRequestVersion = 0;
  private destroyed = false;

  constructor(role: LiveClientRole, dependencies: LiveRuntimeDependencies = {}) {
    this.role = role;
    this.transport = {
      createLiveSession,
      getLiveSnapshot,
      getRosterPage,
      joinLiveSession,
      submitLiveAnswer,
      applyLiveAction,
      streamLiveEvents,
      createRequestId,
      ...dependencies.transport,
    };
    this.storage = dependencies.storage === undefined ? defaultStorage() : dependencies.storage;
    this.sleep = dependencies.sleep ?? defaultSleep;
    this.random = dependencies.random ?? Math.random;
  }

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish = (patch: Partial<LiveRuntimeState>) => {
    if (this.destroyed) return;
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  };

  private safeStorageGet = (key: string) => {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };

  private safeStorageSet = (key: string, value: string) => {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // Session continuity should not depend on storage availability.
    }
  };

  private resetInternals = () => {
    this.lifecycleVersion += 1;
    this.rosterRequestVersion += 1;
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.selectedSessionId = null;
    this.snapshotValue = null;
    this.cursor = { ...INITIAL_CURSOR };
    this.rosterCursor = "";
    this.rosterOrderValue = "joined";
    this.rosterValue = [];
    this.refreshPromise = null;
    this.refreshDirty = false;
    this.commandInFlight = false;
    this.pendingActionIds.clear();
  };

  private selectSession = (sessionId: string) => {
    if (this.selectedSessionId === sessionId) return;
    this.lifecycleVersion += 1;
    this.rosterRequestVersion += 1;
    this.streamAbort?.abort();
    this.streamAbort = null;
    this.selectedSessionId = sessionId;
    this.snapshotValue = null;
    this.cursor = { ...INITIAL_CURSOR };
    this.rosterCursor = "";
    this.rosterOrderValue = "joined";
    this.rosterValue = [];
    this.refreshPromise = null;
    this.refreshDirty = false;
    this.commandInFlight = false;
    this.pendingActionIds.clear();
    this.publish({
      sessionId,
      snapshot: null,
      roster: [],
      rosterOrder: "joined",
      hasMoreRoster: false,
      isRosterLoading: false,
      lastJoinResult: null,
    });
  };

  private storeSnapshot = (next: LiveSnapshot) => {
    const incoming = liveCursorFromSnapshot(next);
    if (
      incoming.eventId < this.cursor.eventId ||
      incoming.stateVersion < this.cursor.stateVersion
    ) {
      return false;
    }

    this.snapshotValue = next;
    this.cursor = incoming;
    this.publish({
      snapshot: next,
      sessionId: this.selectedSessionId,
    });
    return true;
  };

  loadRoster = async (
    order: RosterOrder = this.rosterOrderValue,
    append = false,
  ) => {
    const id = this.selectedSessionId;
    if (!id || this.role !== "manager") return false;
    const lifecycleVersion = this.lifecycleVersion;
    const requestVersion = ++this.rosterRequestVersion;

    this.publish({ isRosterLoading: true });
    try {
      const cursor =
        append && order === this.rosterOrderValue ? this.rosterCursor : "";
      const page: RosterPage = await this.transport.getRosterPage(
        id,
        order,
        cursor,
        100,
      );
      if (
        id !== this.selectedSessionId ||
        lifecycleVersion !== this.lifecycleVersion ||
        requestVersion !== this.rosterRequestVersion
      ) {
        return false;
      }

      const nextItems = append
        ? [...this.rosterValue, ...page.items]
        : page.items;
      this.rosterValue = nextItems;
      this.rosterCursor = page.next_cursor || "";
      this.rosterOrderValue = order;
      this.publish({
        roster: nextItems,
        rosterOrder: order,
        hasMoreRoster: page.has_more,
      });
      return true;
    } catch (error) {
      if (
        id === this.selectedSessionId &&
        lifecycleVersion === this.lifecycleVersion &&
        requestVersion === this.rosterRequestVersion
      ) {
        this.publish({ connectionError: errorMessage(error) });
      }
      return false;
    } finally {
      if (
        id === this.selectedSessionId &&
        lifecycleVersion === this.lifecycleVersion &&
        requestVersion === this.rosterRequestVersion
      ) {
        this.publish({ isRosterLoading: false });
      }
    }
  };

  loadMoreRoster = () => this.loadRoster(this.rosterOrderValue, true);

  private refreshAuthoritative = async (): Promise<LiveSnapshot> => {
    const id = this.selectedSessionId;
    if (!id) throw new Error("Live session is not selected");
    const lifecycleVersion = this.lifecycleVersion;

    if (this.refreshPromise) {
      this.refreshDirty = true;
      return this.refreshPromise;
    }

    const refresh = (async () => {
      let next: LiveSnapshot;
      do {
        this.refreshDirty = false;
        next = await this.transport.getLiveSnapshot(id);
        if (
          id !== this.selectedSessionId ||
          lifecycleVersion !== this.lifecycleVersion
        ) {
          throw new Error("Live session changed during refresh");
        }

        if (!this.storeSnapshot(next)) {
          this.refreshDirty = true;
          continue;
        }

        if (next.role === "manager") {
          await this.loadRoster(
            next.session.stage_view === "overall_ranking" ||
            next.session.state === "ended"
              ? "score"
              : "joined",
            false,
          );
        } else {
          this.rosterValue = [];
          this.rosterCursor = "";
          this.publish({ roster: [], hasMoreRoster: false });
        }

        if (
          id !== this.selectedSessionId ||
          lifecycleVersion !== this.lifecycleVersion
        ) {
          throw new Error("Live session changed during refresh");
        }
      } while (
        this.refreshDirty &&
        this.selectedSessionId === id &&
        lifecycleVersion === this.lifecycleVersion
      );

      return next;
    })();

    this.refreshPromise = refresh;
    try {
      return await refresh;
    } finally {
      if (this.refreshPromise === refresh) {
        this.refreshPromise = null;
      }
    }
  };

  private handleEvent = (event: LiveEvent) => {
    if (!shouldApplyLiveEvent(this.cursor, event)) return;
    this.cursor = advanceLiveCursor(this.cursor, event);

    if (event.name === "presence.updated") {
      const delta = Number(recordPayload(event.payload).participant_delta || 0);
      if (delta !== 0 && this.snapshotValue) {
        const next: LiveSnapshot = {
          ...this.snapshotValue,
          participant_count: Math.max(
            0,
            Number(this.snapshotValue.participant_count || 0) + delta,
          ),
        };
        this.snapshotValue = next;
        this.publish({ snapshot: next });
      }
      if (this.role === "manager") {
        const order: RosterOrder =
          this.snapshotValue &&
          this.snapshotValue.session.stage_view === "overall_ranking" ||
          this.snapshotValue.session.state === "ended"
            ? "score"
            : "joined";
        void this.loadRoster(order, false);
      }
      return;
    }

    if (event.name === "activity.result_updated") {
      const result = normalizeActivityResult(event.payload);
      if (result && this.snapshotValue) {
        const next: LiveSnapshot = {
          ...this.snapshotValue,
          activity_result: result,
        };
        this.snapshotValue = next;
        this.publish({ snapshot: next });
      }
      return;
    }

    if (
      ["session.created", "session.state_changed", "ranking.updated"].includes(
        event.name,
      )
    ) {
      void this.refreshAuthoritative().catch((error) => {
        this.publish({ connectionError: errorMessage(error) });
      });
    }
  };

  private startStream = () => {
    const id = this.selectedSessionId;
    if (!id || !this.snapshotValue?.role || this.streamAbort || this.destroyed) {
      return;
    }

    const controller = new AbortController();
    this.streamAbort = controller;

    void (async () => {
      let retry = 500;
      try {
        while (!controller.signal.aborted && id === this.selectedSessionId) {
          try {
            this.publish({ isConnected: true, connectionError: null });
            await this.transport.streamLiveEvents(id, this.cursor.eventId, {
              signal: controller.signal,
              onEvent: (event) => {
                if (id !== this.selectedSessionId) return;
                retry = 500;
                this.handleEvent(event);
              },
            });
            if (!controller.signal.aborted) {
              throw new Error("event_stream_closed");
            }
          } catch (error) {
            if (controller.signal.aborted || id !== this.selectedSessionId) {
              return;
            }

            this.publish({
              isConnected: false,
              connectionError: errorMessage(error),
            });
            if (
              error instanceof LiveAPIError &&
              [401, 404].includes(error.status)
            ) {
              return;
            }

            const jitter = 0.75 + this.random() * 0.5;
            await this.sleep!(Math.round(retry * jitter), controller.signal);
            retry = Math.min(retry * 2, 10_000);
            if (controller.signal.aborted || id !== this.selectedSessionId) {
              return;
            }

            try {
              await this.refreshAuthoritative();
            } catch (snapshotError) {
              this.publish({ connectionError: errorMessage(snapshotError) });
            }
          }
        }
      } finally {
        if (this.streamAbort === controller) this.streamAbort = null;
      }
    })();
  };

  connect = async (identifier: string | number) => {
    if (!identifier) return false;
    const requestedId = String(identifier);
    this.publish({ connectionError: null });
    this.selectSession(requestedId);
    let lifecycleVersion = this.lifecycleVersion;
    let selectedId = requestedId;
    const isCurrent = () =>
      lifecycleVersion === this.lifecycleVersion &&
      selectedId === this.selectedSessionId;

    try {
      if (this.role === "player") {
        this.publish({ isConnected: true });
        return true;
      }

      const createKey = `proslides_live_create_request:${requestedId}`;
      let requestId = this.safeStorageGet(createKey);
      if (!requestId) {
        requestId = this.transport.createRequestId();
        this.safeStorageSet(createKey, requestId);
      }

      let created = await this.transport.createLiveSession(requestedId, requestId);
      if (!isCurrent()) return false;
      this.selectSession(created.id);
      selectedId = created.id;
      lifecycleVersion = this.lifecycleVersion;
      let next = await this.transport.getLiveSnapshot(created.id);
      if (!isCurrent()) return false;

      if (next.session.state === "ended") {
        requestId = this.transport.createRequestId();
        this.safeStorageSet(createKey, requestId);
        created = await this.transport.createLiveSession(requestedId, requestId);
        if (!isCurrent()) return false;
        this.selectSession(created.id);
        selectedId = created.id;
        lifecycleVersion = this.lifecycleVersion;
        next = await this.transport.getLiveSnapshot(created.id);
        if (!isCurrent()) return false;
      }

      if (next.role === "manager" && next.session.state === "draft") {
        const lobbyKey = `proslides_live_lobby_request:${next.session.id}`;
        let lobbyRequestId = this.safeStorageGet(lobbyKey);
        if (!lobbyRequestId) {
          lobbyRequestId = this.transport.createRequestId();
          this.safeStorageSet(lobbyKey, lobbyRequestId);
        }
        try {
          await this.transport.applyLiveAction(next.session.id, {
            request_id: lobbyRequestId,
            expected_state_version: next.session.state_version,
            action: "start",
          });
        } catch (error) {
          if (!(error instanceof LiveAPIError) || error.status !== 409) {
            throw error;
          }
        }
        if (!isCurrent()) return false;
        next = await this.transport.getLiveSnapshot(next.session.id);
        if (!isCurrent()) return false;
        if (next.session.state === "draft") {
          throw new Error("Live session could not enter the lobby");
        }
      }

      if (!isCurrent()) return false;
      this.storeSnapshot(next);
      if (next.role === "manager") {
        await this.loadRoster(
          ["leaderboard", "ended"].includes(next.session.state)
            ? "score"
            : "joined",
          false,
        );
      }
      if (!isCurrent()) return false;
      this.publish({ isConnected: true });
      this.startStream();
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      this.publish({
        connectionError: errorMessage(error),
        isConnected: false,
      });
      return false;
    }
  };

  disconnect = () => {
    this.resetInternals();
    this.state = initialState();
    if (!this.destroyed) {
      for (const listener of this.listeners) listener();
    }
  };

  private runAction = async (
    action: LiveActionName,
    slide?: LiveCommandSlide,
  ) => {
    const id = this.selectedSessionId;
    const current = this.snapshotValue;
    if (!id || current?.role !== "manager") return false;

    const itemId = slide?.slide_id == null ? "" : String(slide.slide_id);
    const key = `${id}:${current.session.state_version}:${action}:${itemId}`;
    let requestId = this.pendingActionIds.get(key);
    if (!requestId) {
      requestId = this.transport.createRequestId();
      this.pendingActionIds.set(key, requestId);
    }

    const result = await this.transport.applyLiveAction(id, {
      request_id: requestId,
      expected_state_version: current.session.state_version,
      action,
      ...(action === "present_item" && itemId ? { item_id: itemId } : {}),
    });

    const next: LiveSnapshot = {
      ...current,
      session: result,
    };
    this.snapshotValue = next;
    this.publish({ snapshot: next });
    this.pendingActionIds.delete(key);
    return true;
  };

  sendNavigation = async (
    command: LiveNavigationCommand,
    options: { slide?: LiveCommandSlide } = {},
  ) => {
    if (this.commandInFlight) return false;
    this.commandInFlight = true;
    try {
      const session = this.snapshotValue?.session;
      const actions = planLiveNavigation(
        session?.state,
        command,
        options.slide,
        session?.activity_phase ?? null,
        session?.stage_view ?? "item",
      );
      for (const action of actions) {
        const applied = await this.runAction(
          action,
          action === "present_item" ? options.slide : undefined,
        );
        if (!applied) throw new Error("Live action was not authorized");
      }
      try {
        await this.refreshAuthoritative();
      } catch (refreshError) {
        this.publish({ connectionError: errorMessage(refreshError) });
      }
      return true;
    } catch (error) {
      this.publish({ connectionError: errorMessage(error) });
      return false;
    } finally {
      this.commandInFlight = false;
    }
  };

  sendEnd = async () => {
    if (this.commandInFlight) return false;
    this.commandInFlight = true;
    try {
      const actions = planLiveEnd(
        this.snapshotValue?.session?.state,
        this.snapshotValue?.session?.activity_phase ?? null,
      );
      for (const action of actions) {
        if (!(await this.runAction(action))) {
          throw new Error("Live end action was not authorized");
        }
      }
      try {
        await this.refreshAuthoritative();
      } catch (refreshError) {
        this.publish({ connectionError: errorMessage(refreshError) });
      }
      return true;
    } catch (error) {
      this.publish({ connectionError: errorMessage(error) });
      return false;
    } finally {
      this.commandInFlight = false;
    }
  };

  joinParticipant = async ({
    name,
    avatar,
    clientUserId,
  }: {
    name: string;
    avatar?: string;
    clientUserId?: string;
  }) => {
    const id = this.selectedSessionId;
    if (!id) return false;

    const requestId = /^[0-9a-f-]{36}$/i.test(String(clientUserId || ""))
      ? String(clientUserId)
      : this.transport.createRequestId();

    try {
      const participant: ParticipantResult =
        await this.transport.joinLiveSession(id, {
          request_id: requestId,
          display_name: name,
          avatar: avatar || "",
        });
      if (id !== this.selectedSessionId) return false;

      this.publish({
        connectionError: null,
        lastJoinResult: {
          clientUserId: requestId,
          participantId: participant.id,
          displayName: participant.display_name,
          avatar: participant.avatar || "",
        },
      });

      await this.refreshAuthoritative();
      this.publish({ isConnected: true });
      this.startStream();
      return true;
    } catch (error) {
      this.publish({ connectionError: errorMessage(error) });
      if (
        error instanceof LiveAPIError &&
        [400, 409].includes(error.status)
      ) {
        return "rejected" as const;
      }
      this.publish({ isConnected: false });
      return false;
    }
  };

  submitAnswer = async (answer: LiveAnswerInput) => {
    const id = this.selectedSessionId;
    if (!id || !answer) return false;

    const selected = answer.selected_option_indexes;
    const unique = new Set(selected);
    if (
      selected.length === 0 ||
      unique.size !== selected.length ||
      selected.some((index) => !Number.isInteger(index) || index < 0)
    ) {
      return "rejected" as const;
    }

    try {
      await this.transport.submitLiveAnswer(id, {
        request_id: answer.request_id || this.transport.createRequestId(),
        activity_item_id: String(answer.question_id),
        selected_option_indexes: selected,
      });
      return true;
    } catch (error) {
      if (
        error instanceof LiveAPIError &&
        [400, 401, 409].includes(error.status)
      ) {
        return "rejected" as const;
      }
      return false;
    }
  };

  destroy = () => {
    if (this.destroyed) return;
    this.resetInternals();
    this.destroyed = true;
    this.listeners.clear();
  };
}

export const createLiveRuntime = (
  role: LiveClientRole,
  dependencies?: LiveRuntimeDependencies,
) => new LiveRuntime(role, dependencies);
