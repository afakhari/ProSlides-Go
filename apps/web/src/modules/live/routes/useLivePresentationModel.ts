import { useEffect, useMemo, useState } from "react";

import type { LiveSnapshot } from "../api/types.ts";
import { getPresentationForLive } from "../api/presentationApi.ts";
import type {
  LivePresentationModel,
} from "../model/presentation.ts";
import type { LiveClientRole } from "../runtime/LiveRuntime.ts";
import { presentationSlideToLegacy } from "../runtime/protocol.js";
import { EMPTY_PRESENTATION } from "../model/presentationFlow.ts";

type UseLivePresentationModelOptions = {
  roomId?: string;
  role: LiveClientRole;
  initialQuizData?: LivePresentationModel | null;
  snapshot: LiveSnapshot | null;
};

export type LivePresentationModelState = {
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

    const controller = new AbortController();

    void getPresentationForLive(roomId, controller.signal)
      .then((presentation) => {
        if (!controller.signal.aborted) {
          setRemoteQuiz(toLivePresentationModel(presentation));
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(
          "[PresentationFlow] could not load presentation",
          error,
        );
      });

    return () => controller.abort();
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
