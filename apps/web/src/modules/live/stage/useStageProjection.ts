import { useCallback, useEffect, useRef, useState } from "react";

import {
  getLiveStageSnapshot,
  LiveAPIError,
  streamLiveEvents,
} from "../api/liveApi.ts";
import type { LiveEvent, StageSnapshot } from "../api/types.ts";
import {
  advanceLiveCursor,
  shouldApplyLiveEvent,
  type LiveCursor,
} from "../runtime/protocol.ts";

type StageProjectionState = {
  snapshot: StageSnapshot | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
};

const initialState: StageProjectionState = {
  snapshot: null,
  isConnected: false,
  isLoading: true,
  error: null,
};

const eventRecord = (payload: unknown): Record<string, unknown> =>
  typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};

const wait = (milliseconds: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const isFatalStageError = (error: unknown) =>
  error instanceof LiveAPIError && [401, 404].includes(error.status);

const errorText = (error: unknown) => {
  if (error instanceof LiveAPIError) {
    if (error.status === 401) return "دسترسی Stage معتبر نیست.";
    if (error.status === 404) return "جلسه زنده پیدا نشد.";
    return "ارتباط Stage برقرار نشد؛ در حال تلاش دوباره…";
  }
  return error instanceof Error
    ? "ارتباط Stage برقرار نشد؛ در حال تلاش دوباره…"
    : "ارتباط Stage برقرار نشد؛ در حال تلاش دوباره…";
};

export function useStageProjection(sessionId: string | undefined) {
  const [state, setState] = useState<StageProjectionState>(initialState);
  const snapshotRef = useRef<StageSnapshot | null>(null);
  const cursorRef = useRef<LiveCursor>({ eventId: 0, stateVersion: 0 });

  const applySnapshot = useCallback((next: StageSnapshot) => {
    const current = snapshotRef.current;
    if (
      current &&
      (next.session.state_version < current.session.state_version ||
        (next.session.state_version === current.session.state_version &&
          next.last_event_id < current.last_event_id))
    ) {
      return current;
    }

    snapshotRef.current = next;
    cursorRef.current = {
      eventId: Math.max(cursorRef.current.eventId, Number(next.last_event_id || 0)),
      stateVersion: Math.max(
        cursorRef.current.stateVersion,
        Number(next.session.state_version || 0),
      ),
    };
    setState((value) => ({
      ...value,
      snapshot: next,
      isLoading: false,
      error: null,
    }));
    return next;
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setState({
        snapshot: null,
        isConnected: false,
        isLoading: false,
        error: "شناسه جلسه معتبر نیست.",
      });
      return;
    }

    const controller = new AbortController();
    snapshotRef.current = null;
    cursorRef.current = { eventId: 0, stateVersion: 0 };
    setState(initialState);

    const refresh = async () => {
      const next = await getLiveStageSnapshot(sessionId, controller.signal);
      if (!controller.signal.aborted) applySnapshot(next);
      return next;
    };

    const handleEvent = (event: LiveEvent) => {
      if (!shouldApplyLiveEvent(cursorRef.current, event)) return;
      cursorRef.current = advanceLiveCursor(cursorRef.current, event);

      if (event.name === "presence.updated") {
        const delta = Number(eventRecord(event.payload).participant_delta ?? 0);
        const current = snapshotRef.current;
        if (current && Number.isFinite(delta) && delta !== 0) {
          const next = {
            ...current,
            participant_count: Math.max(0, current.participant_count + delta),
          };
          snapshotRef.current = next;
          setState((value) => ({ ...value, snapshot: next }));
        }
        return;
      }

      if (
        event.name === "session.created" ||
        event.name === "session.state_changed" ||
        event.name === "ranking.updated"
      ) {
        void refresh().catch((error) => {
          if (!controller.signal.aborted) {
            setState((value) => ({ ...value, error: errorText(error) }));
          }
        });
      }
    };

    void (async () => {
      let retry = 500;

      while (!controller.signal.aborted && !snapshotRef.current) {
        try {
          await refresh();
          retry = 500;
        } catch (error) {
          if (controller.signal.aborted) return;
          setState({
            snapshot: null,
            isConnected: false,
            isLoading: false,
            error: errorText(error),
          });
          if (isFatalStageError(error)) return;
          await wait(retry, controller.signal);
          retry = Math.min(retry * 2, 10_000);
        }
      }

      while (!controller.signal.aborted) {
        try {
          setState((value) => ({
            ...value,
            isConnected: false,
            error: null,
          }));
          await streamLiveEvents(sessionId, cursorRef.current.eventId, {
            signal: controller.signal,
            onOpen: () => {
              if (controller.signal.aborted) return;
              setState((value) => ({
                ...value,
                isConnected: true,
                error: null,
              }));
            },
            onEvent: handleEvent,
          });
          if (!controller.signal.aborted) {
            throw new Error("stage_event_stream_closed");
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setState((value) => ({
            ...value,
            isConnected: false,
            error: errorText(error),
          }));
          if (isFatalStageError(error)) return;

          await wait(retry, controller.signal);
          retry = Math.min(retry * 2, 10_000);
          if (controller.signal.aborted) return;

          try {
            await refresh();
            retry = 500;
          } catch (snapshotError) {
            if (!controller.signal.aborted) {
              setState((value) => ({
                ...value,
                error: errorText(snapshotError),
              }));
            }
          }
        }
      }
    })();

    return () => controller.abort();
  }, [applySnapshot, sessionId]);

  return state;
}
