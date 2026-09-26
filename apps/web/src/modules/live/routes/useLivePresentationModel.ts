import { useEffect, useMemo, useState } from "react";

import type { LiveSnapshot } from "../api/types.ts";
import { getPresentationForLive } from "../api/presentationApi.ts";
import type {
  LivePresentationModel,
} from "../model/presentation.ts";
import type { LiveClientRole } from "../runtime/LiveRuntime.ts";
import { presentationSlideToLegacy } from "../runtime/protocol.ts";
import { EMPTY_PRESENTATION } from "../model/presentationFlow.ts";

type UseLivePresentationModelOptions = {
  roomId?: string;
  role: LiveClientRole;
  initialQuizData?: LivePresentationModel | null;
  snapshot: LiveSnapshot | null;
};

type LivePresentationModelState = {
  remoteQuiz: LivePresentationModel | null;
  quiz: LivePresentationModel;
  isRemoteReady: boolean;
};

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

export const toLivePresentationModel = (
  presentation: Awaited<ReturnType<typeof getPresentationForLive>>,
): LivePresentationModel => {
  const settings = presentation.settings ?? {};
  const textColor = stringValue(settings.text_color, "#111827");

  return {
    quiz_id: presentation.id,
    title: presentation.title,
    access_code: presentation.access_code || "",
    background: {
      color: stringValue(settings.background_color, "#1e1e2e"),
      image: stringValue(settings.background_image_url),
      text_color: textColor,
    },
    music_url: stringValue(settings.music_url),
    slides: Array.isArray(presentation.slides)
      ? presentation.slides.map(presentationSlideToLegacy)
      : [],
    text_color: textColor,
  };
};

export function useLivePresentationModel({
  roomId,
  role,
  initialQuizData = null,
  snapshot,
}: UseLivePresentationModelOptions): LivePresentationModelState {
  const [remoteQuiz, setRemoteQuiz] =
    useState<LivePresentationModel | null>(initialQuizData);

  useEffect(() => {
    if (role !== "player" || !initialQuizData) return;
    setRemoteQuiz((current) => current ?? initialQuizData);
  }, [initialQuizData, role]);

  useEffect(() => {
    if (role !== "manager" || !roomId) return;

    let stopped = false;
    let activeController: AbortController | null = null;
    let retryTimer = 0;
    let wakeRetry: (() => void) | null = null;
    let reported = false;

    const wait = (milliseconds: number) =>
      new Promise<void>((resolve) => {
        wakeRetry = resolve;
        retryTimer = window.setTimeout(() => {
          retryTimer = 0;
          wakeRetry = null;
          resolve();
        }, milliseconds);
      });

    void (async () => {
      let retry = 750;
      while (!stopped) {
        const controller = new AbortController();
        activeController = controller;
        const timeout = window.setTimeout(() => controller.abort(), 15_000);

        try {
          const presentation = await getPresentationForLive(
            roomId,
            controller.signal,
          );
          if (!stopped) {
            setRemoteQuiz(toLivePresentationModel(presentation));
          }
          return;
        } catch (error: unknown) {
          if (stopped) return;
          if (!reported) {
            reported = true;
            console.error(
              "[PresentationFlow] could not load presentation; retrying",
              error,
            );
          }
        } finally {
          window.clearTimeout(timeout);
          if (activeController === controller) activeController = null;
        }

        await wait(retry);
        retry = Math.min(retry * 2, 10_000);
      }
    })();

    return () => {
      stopped = true;
      activeController?.abort();
      if (retryTimer) window.clearTimeout(retryTimer);
      wakeRetry?.();
    };
  }, [role, roomId]);

  const quiz = useMemo<LivePresentationModel>(() => {
    const baseQuiz = remoteQuiz ?? EMPTY_PRESENTATION;
    return snapshot?.role === "manager"
      ? {
          ...baseQuiz,
          access_code: snapshot.session.join_code,
        }
      : baseQuiz;
  }, [remoteQuiz, snapshot]);

  return {
    remoteQuiz,
    quiz,
    isRemoteReady: role === "player" || remoteQuiz !== null,
  };
}
