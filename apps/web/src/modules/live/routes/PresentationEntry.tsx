import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { AudioProvider } from "../../../contexts/AudioContext.tsx";
import Waiting from "../../../pages/loading/LoadingPage";
import {
  LiveAPIError,
  resolveLiveSession,
} from "../api/liveApi.ts";
import type { LiveSessionLocator } from "../api/types.ts";
import type {
  AppPresentationComponent,
  LivePresentationModel,
} from "../model/presentation.ts";
import type { LiveClientRole } from "../runtime/LiveRuntime.ts";
import { LiveSessionProvider } from "../react/LiveSessionProvider.tsx";
import { ServerDataProvider } from "../react/ServerDataProvider.tsx";
import { AppPresentation } from "./PresentationFlow.jsx";

type PresentationEntryMode = "presentation" | "accessCode";

type PresentationEntryProps = {
  mode: PresentationEntryMode;
  role?: LiveClientRole;
};

type ResolveStatus = "loading" | "error" | "success";

const TypedAppPresentation =
  AppPresentation as AppPresentationComponent;

export default function PresentationEntry({
  mode,
  role,
}: PresentationEntryProps) {
  return mode === "accessCode" ? (
    <AccessCodeResolver />
  ) : (
    <PresentationRouter explicitRole={role} />
  );
}

function AccessCodeResolver() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const [status, setStatus] = useState<ResolveStatus>("loading");
  const [resolvedData, setResolvedData] =
    useState<LiveSessionLocator | null>(null);
  const [resolvedMeta, setResolvedMeta] =
    useState<LivePresentationModel | null>(null);

  useEffect(() => {
    let active = true;

    const resolveCode = async () => {
      if (!accessCode) {
        if (active) setStatus("error");
        return;
      }

      try {
        const data = await resolveLiveSession(accessCode);
        if (!active) return;

        if (!data.session_id) {
          setStatus("error");
          return;
        }

        setResolvedData(data);
        setResolvedMeta({
          quiz_id: data.presentation_id,
          title: data.presentation.title,
          access_code: accessCode,
          background: {
            color: data.presentation.background_color,
            image: data.presentation.background_image_url,
            text_color: data.presentation.text_color,
          },
          music_url: data.presentation.music_url || "",
          slides: [],
          text_color: data.presentation.text_color,
        });
        setStatus("success");
      } catch (error) {
        if (
          active &&
          !(error instanceof LiveAPIError && error.status === 404)
        ) {
          console.error("[AccessCodeResolver] Error:", error);
        }
        if (active) setStatus("error");
      }
    };

    void resolveCode();
    return () => {
      active = false;
    };
  }, [accessCode]);

  if (status === "loading") {
    return <Waiting message="در حال ورود به کوئیز…" />;
  }

  if (status === "error") {
    return <Waiting message="کد ورود معتبر نیست" />;
  }

  if (resolvedData && resolvedMeta) {
    return (
      <AudioProvider>
        <LiveSessionProvider
          key={`player:${resolvedData.session_id}`}
          role="player"
        >
          <ServerDataProvider>
            <TypedAppPresentation
              roomId={resolvedData.session_id}
              role="player"
              initialQuizData={resolvedMeta}
            />
          </ServerDataProvider>
        </LiveSessionProvider>
      </AudioProvider>
    );
  }

  return <Waiting message="در حال آماده‌سازی جلسه…" />;
}

function PresentationRouter({
  explicitRole,
}: {
  explicitRole?: LiveClientRole;
}) {
  const { roomId } = useParams<{ roomId: string }>();
  const role: LiveClientRole =
    explicitRole === "player" ? "player" : "manager";

  return (
    <AudioProvider>
      <LiveSessionProvider
        key={`${role}:${roomId || "unknown"}`}
        role={role}
      >
        <ServerDataProvider>
          <TypedAppPresentation roomId={roomId} role={role} />
        </ServerDataProvider>
      </LiveSessionProvider>
    </AudioProvider>
  );
}
