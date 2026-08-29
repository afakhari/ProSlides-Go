import React, { useState, useEffect, useRef, lazy } from "react";
import { useParams } from "react-router-dom";

import { LiveSessionProvider } from "../contexts/LiveSessionContext";
import { ServerDataProvider } from "../contexts/ServerDataContext";
import { useServerData } from "../hooks/useServerData";
import { useLiveSession } from "../hooks/useLiveSession";
import { AudioProvider, useAudio } from "../contexts/AudioContext";
import { getPresentation, resolveLiveSession } from "../live/liveApi";
import { presentationSlideToLegacy } from "../live/protocol";
import { hasLeaderboardEntries } from "../pages/presentation/utils/leaderboardUtils";
import { resolveQuestionTimer } from "../pages/presentation/utils/questionTimerSync";
import {
  getPersistedUserIdForRoom,
  readStoredProfile,
} from "../pages/presentation/player/playerProfileStorage";

import Waiting from "../pages/loading/LoadingPage";
import FinalLeaderboard from "../pages/presentation/manager/FinalLeaderboard";

const ManagerJoinPage = lazy(() =>
  import("../pages/presentation/manager/JoinPage")
);
const ManagerPickAnswerQuestion = lazy(() =>
  import("../pages/presentation/manager/PickAnswerQuestion")
);
const ManagerLeaderBoard = lazy(() =>
  import("../pages/presentation/manager/LeaderBoard")
);
const ManagerContentSlide = lazy(() =>
  import("../pages/presentation/manager/ContentSlide")
);
const PlayerJoinPage = lazy(() =>
  import("../pages/presentation/player/JoinPage")
);
const PlayerPickAnswerQuestion = lazy(() =>
  import("../pages/presentation/player/PickAnswerQuestion")
);
const PlayerLeaderBoard = lazy(() =>
  import("../pages/presentation/player/LeaderBoard")
);
const PlayerContentSlide = lazy(() =>
  import("../pages/presentation/player/ContentSlide")
);

const isQuestionSlide = (slide) =>
  !!slide &&
  typeof slide === "object" &&
  (slide.slide_type === 1 || slide.question_id != null);

const hasContentPayload = (slide) =>
  !!slide &&
  typeof slide === "object" &&
  (String(slide.title || "").trim().length > 0 ||
    String(slide.content_text || "").trim().length > 0 ||
    String(slide.content_image_url || "").trim().length > 0);

const isLeaderboardSlide = (slide) => {
  if (!slide || typeof slide !== "object") return false;
  if (slide.slide_type === 3) return true;
  if (isQuestionSlide(slide)) return false;
  // Some payloads encode leaderboard as slide_type=2 without content fields.
  return slide.slide_type === 2 && !hasContentPayload(slide);
};

const isContentSlide = (slide) =>
  !!slide &&
  typeof slide === "object" &&
  !isQuestionSlide(slide) &&
  hasContentPayload(slide);

const EMPTY_PRESENTATION = {
  quiz_id: "",
  title: "",
  access_code: "",
  background: { color: "#1e1e2e", image: "", text_color: "#111827" },
  music_url: "",
  slides: [],
  text_color: "#111827",
};

export default function PresentationEntry({ mode }) {
  return (
    <ServerDataProvider>
      {mode === "accessCode" ? <AccessCodeResolver /> : <PresentationRouter />}
    </ServerDataProvider>
  );
}

/* ------------------------ Access Code Resolver ------------------------ */
function AccessCodeResolver() {
  const { accessCode } = useParams();
  const [status, setStatus] = useState("loading"); // loading | error | success
  const [resolvedData, setResolvedData] = useState(null);
  const [resolvedMeta, setResolvedMeta] = useState(null);

  useEffect(() => {
    let mounted = true;
    const resolveCode = async () => {
      try {
        const data = await resolveLiveSession(accessCode);

        if (!mounted) return;

        if (data.session_id) {
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
            music_url: "",
            slides: [],
            text_color: data.presentation.text_color,
          });
          setStatus("success");
        } else {
          // Invalid access code
          setStatus("error");
        }
      } catch (err) {
        if (err?.status !== 404) {
          console.error("[AccessCodeResolver] Error:", err);
        }
        if (mounted) setStatus("error");
      }
    };

    resolveCode();
    return () => {
      mounted = false;
    };
  }, [accessCode]);

  // Loading state
  if (status === "loading") {
    return <Waiting message="در حال ورود به کوئیز…" />;
  }

  // Error state
  if (status === "error") {
    return <Waiting message="کد ورود معتبر نیست" />;
  }

  // Success - render player presentation directly (URL stays the same)
  if (status === "success" && resolvedData) {
    return (
      <AudioProvider>
        <LiveSessionProvider role="player">
          <AppPresentation
            roomId={String(resolvedData.session_id)}
            role="player"
            initialQuizData={resolvedMeta}
          />
          <LiveMessageHandler />
        </LiveSessionProvider>
      </AudioProvider>
    );
  }

  return <Waiting />;
}

/* ------------------------ Router Wrapper ------------------------ */
function PresentationRouter() {
  const { roomId, role } = useParams();
  const liveRole = role === "player" ? "player" : "manager";

  return (
    <AudioProvider>
      <LiveSessionProvider role={liveRole}>
        <AppPresentation roomId={roomId} role={role} />
        <LiveMessageHandler />
      </LiveSessionProvider>
    </AudioProvider>
  );
}

/* ------------------------ Main Flow ------------------------ */
function AppPresentation({ roomId, role, initialQuizData }) {
  const playerActiveSlideSeenKey = `presentation_player_seen_active_v1:${String(
    roomId || "unknown"
  )}`;
  const playerLastActiveKey = `presentation_player_last_active_v1:${String(
    roomId || "unknown"
  )}`;
  const getInitialSeenActive = () => {
    if (role !== "player") return false;
    try {
      return sessionStorage.getItem(playerActiveSlideSeenKey) === "1";
    } catch {
      return false;
    }
  };
  const getInitialPlayerLastActive = () => {
    if (role !== "player") return null;
    try {
      const raw = localStorage.getItem(playerLastActiveKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      if (!["question", "content"].includes(parsed.kind)) return null;
      if (!parsed.payload || typeof parsed.payload !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  };
  const [data, setData] = useState({ type: "ManagerJoinPage" });
  const [currentSlide, setCurrentSlide] = useState(1);
  const [playerHasSeenActiveSlide, setPlayerHasSeenActiveSlide] = useState(
    getInitialSeenActive
  );
  const [playerLastActive, setPlayerLastActive] = useState(
    getInitialPlayerLastActive
  );
  const playerResumeJoinSentRef = useRef(false);

  // Fetch full quiz once at top-level and transform to internal shape
  const [remoteQuiz, setRemoteQuiz] = useState(initialQuizData || null);

  // Initialize remoteQuiz with initialQuizData if available (for player)
  useEffect(() => {
    if (initialQuizData && role === "player") {
      // Handle potential flat structure or nested structure for background
      const rawBg = initialQuizData.background || {};
      const background = {
        color: rawBg.color || initialQuizData.background_color || "#1e1e2e",
        image:
          rawBg.image ||
          initialQuizData.background_image ||
          initialQuizData.background_image_url ||
          "",
      };

      setRemoteQuiz((prev) => prev || {
        quiz_id: initialQuizData.quiz_id,
        title: initialQuizData.title || "",
        access_code: initialQuizData.access_code || "",
        background: background,
        music_url: initialQuizData.music_url || "",
        slides: [], // Player doesn't need full slides initially
      });
    }
  }, [initialQuizData, role]);

  useEffect(() => {
    let mounted = true;
    const fetchQuiz = async () => {
      try {
        if (!roomId) return;

        // If we already have initial data for player, we might skip full fetch or do it in background
        // But if user wants ONLY this API for player, we skip fetch for player
        if (role === "player") return;

        const data = await getPresentation(roomId);
        if (!mounted) return;
        if (data && Array.isArray(data.slides)) {
          const mappedSlides = data.slides.map(presentationSlideToLegacy);
          const quizData = {
            quiz_id: data.id,
            title: data.title,
            access_code: data.access_code || "",
            background: {
              color: data.settings?.background_color || "#1e1e2e",
              image: data.settings?.background_image_url || "",
              text_color: data.settings?.text_color || "#111827",
            },
            music_url: data.settings?.music_url || "",
            slides: mappedSlides,
            text_color: data.settings?.text_color || "#111827",
          };

          setRemoteQuiz(quizData);
        }
      } catch (err) {
        console.error("[AppPresentation] could not load remote quiz", err);
      }
    };
    fetchQuiz();
    return () => {
      mounted = false;
    };
  }, [role, roomId, initialQuizData]);

  const {
    isConnected,
    connect,
    joinParticipant,
    snapshot,
    sessionId: liveSessionId,
  } = useLiveSession();
  useEffect(() => {
    if (role !== "manager" || !roomId || liveSessionId) return;
    void connect(roomId);
  }, [role, roomId, liveSessionId, connect]);
  const quiz = React.useMemo(() => {
    const baseQuiz = remoteQuiz ?? EMPTY_PRESENTATION;
    return snapshot?.role === "manager"
      ? { ...baseQuiz, access_code: snapshot.session.join_code }
      : baseQuiz;
  }, [remoteQuiz, snapshot]);
  const isRemoteReady = role === "player" || !!remoteQuiz;
  const totalSlides = quiz.slides.length;

  // Set quiz music when loaded
  const { setQuizMusic } = useAudio();
  useEffect(() => {
    if (remoteQuiz?.music_url) {
      setQuizMusic(remoteQuiz.music_url);
    }
  }, [remoteQuiz?.music_url, setQuizMusic]);

  const {
    currentQuestion,
    currentContent,
    leaderboardResults,
    questionResults,
    partialQuestionResults,
    modalLeaderboardResults,
  } = useServerData();
  const hasLeaderboard = hasLeaderboardEntries(leaderboardResults);
  const playerResumeProfile =
    role === "player" ? readStoredProfile(roomId) : null;
  const shouldAutoResumePlayerSession =
    role === "player" &&
    !!playerResumeProfile &&
    playerHasSeenActiveSlide &&
    !currentQuestion &&
    !currentContent &&
    !hasLeaderboard;

  useEffect(() => {
    if (!shouldAutoResumePlayerSession || !roomId) return;
    if (isConnected) return;

    try {
      connect(roomId);
    } catch (err) {
      console.error("[PresentationEntry] player resume connect failed:", err);
    }
  }, [shouldAutoResumePlayerSession, roomId, isConnected, connect]);

  useEffect(() => {
    if (!shouldAutoResumePlayerSession) {
      playerResumeJoinSentRef.current = false;
      return;
    }
    if (!isConnected) {
      playerResumeJoinSentRef.current = false;
      return;
    }
    if (playerResumeJoinSentRef.current) return;
    if (!playerResumeProfile) return;

    playerResumeJoinSentRef.current = true;
    void joinParticipant({
        name: playerResumeProfile.name,
        avatar: playerResumeProfile.avatar,
        clientUserId: getPersistedUserIdForRoom(roomId),
    }).then((ok) => {
      if (!ok) playerResumeJoinSentRef.current = false;
    });
  }, [
    shouldAutoResumePlayerSession,
    isConnected,
    playerResumeProfile,
    roomId,
    joinParticipant,
  ]);
  const [managerHasSyncedState, setManagerHasSyncedState] = useState(
    role !== "manager"
  );
  const [lastManagerQuestionSlideIndex, setLastManagerQuestionSlideIndex] =
    useState(null);
  useEffect(() => {
    if (role !== "player") return;
    if (currentQuestion || currentContent) {
      setPlayerHasSeenActiveSlide(true);
      try {
        sessionStorage.setItem(playerActiveSlideSeenKey, "1");
      } catch {
        // ignore storage errors
      }
    }
    if (currentQuestion) {
      const snapshot = {
        kind: "question",
        payload: currentQuestion,
        updatedAt: Date.now(),
      };
      setPlayerLastActive(snapshot);
      try {
        localStorage.setItem(playerLastActiveKey, JSON.stringify(snapshot));
      } catch {
        // ignore storage errors
      }
    } else if (currentContent) {
      const snapshot = {
        kind: "content",
        payload: currentContent,
        updatedAt: Date.now(),
      };
      setPlayerLastActive(snapshot);
      try {
        localStorage.setItem(playerLastActiveKey, JSON.stringify(snapshot));
      } catch {
        // ignore storage errors
      }
    }
  }, [
    role,
    currentQuestion,
    currentContent,
    playerActiveSlideSeenKey,
    playerLastActiveKey,
  ]);

  useEffect(() => {
    if (role !== "manager") return;
    if (managerHasSyncedState) return;

    const hasLiveSignal =
      !!currentQuestion ||
      !!currentContent ||
      hasLeaderboardEntries(leaderboardResults);

    if (hasLiveSignal) {
      setManagerHasSyncedState(true);
      return;
    }

    const timer = setTimeout(() => {
      setManagerHasSyncedState(true);
    }, isConnected ? 2500 : 3500);

    return () => clearTimeout(timer);
  }, [
    role,
    managerHasSyncedState,
    currentQuestion,
    currentContent,
    leaderboardResults,
    isConnected,
  ]);

  // Sync manager slide index with server question id to avoid UI mismatches
  useEffect(() => {
    if (role !== "manager") return;
    if (!currentQuestion || !quiz?.slides?.length) return;

    const idx = quiz.slides.findIndex(
      (slide) =>
        String(slide.question_id ?? slide.question?.question_id ?? "") ===
        String(currentQuestion.question_id ?? "")
    );

    if (idx >= 0) {
      setLastManagerQuestionSlideIndex(idx);
      if (currentSlide !== idx + 1) {
        setCurrentSlide(idx + 1);
      }
    }

    if (data.type !== "ManagerPickAnswerQuestion") {
      setData({ type: "ManagerPickAnswerQuestion" });
    }
  }, [role, currentQuestion, quiz, currentSlide, data.type]);

  useEffect(() => {
    if (role !== "manager") return;
    if (!currentContent) return;

    if (quiz?.slides?.length) {
      const incomingOrder =
        currentContent.order ??
        currentContent.slide_order ??
        currentContent.slideOrder ??
        null;
      const idx = quiz.slides.findIndex(
        (slide) =>
          slide.slide_id === currentContent.slide_id ||
          (incomingOrder != null && slide.order === incomingOrder)
      );

      if (idx >= 0 && currentSlide !== idx + 1) {
        setCurrentSlide(idx + 1);
      }
    }

    if (data.type !== "ManagerContentSlide") {
      setData({ type: "ManagerContentSlide" });
    }
  }, [role, currentContent, quiz, currentSlide, data.type]);

  // Keep the manager route aligned with the authoritative leaderboard state.
  useEffect(() => {
    if (role !== "manager" || !hasLeaderboardEntries(leaderboardResults)) {
      return;
    }

    if (quiz?.slides?.length) {
      let nextLeaderboardIdx = -1;

      if (lastManagerQuestionSlideIndex != null) {
        const questionOrder =
          quiz.slides[lastManagerQuestionSlideIndex]?.order ?? null;
        if (questionOrder != null) {
          nextLeaderboardIdx = quiz.slides.findIndex(
            (slide, idx) =>
              idx !== lastManagerQuestionSlideIndex &&
              !isQuestionSlide(slide) &&
              slide.order === questionOrder
          );
        }

        if (nextLeaderboardIdx < 0) {
          const immediateIdx = lastManagerQuestionSlideIndex + 1;
          if (isLeaderboardSlide(quiz.slides[immediateIdx])) {
            nextLeaderboardIdx = immediateIdx;
          } else {
            nextLeaderboardIdx = quiz.slides.findIndex(
              (slide, idx) =>
                idx > lastManagerQuestionSlideIndex && isLeaderboardSlide(slide)
            );
          }
        }
      }

      if (nextLeaderboardIdx < 0) {
        const currentIdx = Math.max(0, currentSlide - 1);
        if (isLeaderboardSlide(quiz.slides[currentIdx])) {
          nextLeaderboardIdx = currentIdx;
        } else {
          nextLeaderboardIdx = quiz.slides.findIndex(
            (slide) => isLeaderboardSlide(slide)
          );
        }
      }

      if (nextLeaderboardIdx >= 0 && currentSlide !== nextLeaderboardIdx + 1) {
        setCurrentSlide(nextLeaderboardIdx + 1);
      }
    }

    setData({ type: "ManagerLeaderBoard" });
  }, [
    leaderboardResults,
    role,
    quiz,
    currentSlide,
    lastManagerQuestionSlideIndex,
  ]);

  /* ------------------ EXACT NEXT/PREVIOUS FROM YOUR CODE ------------------ */

  const handleNext = () => {
    if (data.type === "ManagerJoinPage") {
      if (hasLeaderboardEntries(leaderboardResults)) {
        setData({ type: "ManagerLeaderBoard" });
        return;
      }
      if (currentContent) {
        setData({ type: "ManagerContentSlide" });
        return;
      }
      if (currentQuestion) {
        setData({ type: "ManagerPickAnswerQuestion" });
        return;
      }
      setData({ type: "ManagerPickAnswerQuestion" });
    } else {
      // For question -> leaderboard, update index immediately for better presenter UX.
      const nextSlide = quiz.slides[currentSlide];
      if (!nextSlide) return;
      if (isLeaderboardSlide(nextSlide)) {
        setData({ type: "ManagerLeaderBoard" });
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
      } else if (isContentSlide(nextSlide)) {
        setData({ type: "ManagerContentSlide" });
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
      } else if (isQuestionSlide(nextSlide)) {
        setData({ type: "ManagerPickAnswerQuestion" });
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
      }
    }
  };

  // Product requirement: presentation flow is forward-only (no previous step).
  const handlePrevious = () => {};

  const handleEndGame = () => {
    setData({ type: "ManagerFinalLeaderboard" });
  };

  /* ---------------- Manager Rendering (EXACT LIKE ORIGINAL) ---------------- */
  const getManagerRenderType = () => {
    if (data.type === "ManagerFinalLeaderboard" || snapshot?.session?.state === "ended") {
      return "ManagerFinalLeaderboard";
    }
    if (hasLeaderboardEntries(leaderboardResults)) {
      return "ManagerLeaderBoard";
    }
    if (currentContent) {
      return "ManagerContentSlide";
    }
    if (currentQuestion) {
      return "ManagerPickAnswerQuestion";
    }
    return data.type;
  };

  const renderManager = () => {
    switch (getManagerRenderType()) {
      case "ManagerJoinPage":
        return (
          <ManagerJoinPage
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerPickAnswerQuestion":
        return (
          <ManagerPickAnswerQuestion
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            isRemoteReady={isRemoteReady}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerLeaderBoard":
        return (
          <ManagerLeaderBoard
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            isRemoteReady={isRemoteReady}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerContentSlide":
        return (
          <ManagerContentSlide
            roomId={roomId}
            onNext={handleNext}
            onPrevious={handlePrevious}
            currentSlide={currentSlide}
            totalSlides={totalSlides}
            quiz={quiz}
            content={currentContent}
            onEndGame={handleEndGame}
          />
        );
      case "ManagerFinalLeaderboard":
        return (
          <FinalLeaderboard
            leaderboardData={modalLeaderboardResults || leaderboardResults}
            quiz={quiz}
            onExit={() => (window.location.href = "/manager/panel")}
          />
        );
      default:
        return <Waiting />;
    }
  };

  /* ---------------- Player Rendering (Server Driven) ---------------- */
  const renderPlayer = () => {
    if (currentContent) {
      return <PlayerContentSlide roomId={roomId} quiz={quiz} content={currentContent} />;
    }
    if (currentQuestion) {
      const hasMatchingQuestion = (candidate) =>
        !!candidate &&
        candidate.question_id != null &&
        String(candidate.question_id) === String(currentQuestion.question_id);
      let result = null;
      if (hasMatchingQuestion(questionResults)) {
        result = questionResults;
      } else if (hasMatchingQuestion(partialQuestionResults)) {
        result = partialQuestionResults;
      }
      return (
        <PlayerPickAnswerQuestion
          roomId={roomId}
          question={currentQuestion}
          result={result}
          quiz={quiz}
        />
      );
    }
    // Do not show stale leaderboard to a fresh player before the quiz has actually started.
    if (hasLeaderboard) {
      return (
        <PlayerLeaderBoard
          roomId={roomId}
          players={leaderboardResults.results || leaderboardResults}
          quiz={quiz}
        />
      );
    }
    if (
      playerHasSeenActiveSlide &&
      playerLastActive?.payload &&
      snapshot?.session?.state === "question_open"
    ) {
      if (playerLastActive.kind === "question") {
        const fallbackQuestion = playerLastActive.payload;
        const fallbackTimer = resolveQuestionTimer({
          question: fallbackQuestion,
          roomId,
          role: "player",
        });

        if (
          fallbackTimer.totalSeconds > 0 &&
          fallbackTimer.remainingSeconds > 0
        ) {
          return (
            <PlayerPickAnswerQuestion
              roomId={roomId}
              question={fallbackQuestion}
              result={null}
              quiz={quiz}
            />
          );
        }
      }

    }

    if (playerHasSeenActiveSlide && playerResumeProfile) {
      return <Waiting message="در حال همگام‌سازی جلسه…" />;
    }
    return <PlayerJoinPage roomId={roomId} quiz={quiz} />;
  };  /* ----------- Final Conditional Rendering ----------- */
  if (role === "manager") {
    return (
      <PresentationErrorBoundary key={`manager-${roomId ?? "unknown"}`}>
        {managerHasSyncedState ? renderManager() : <Waiting message="در حال همگام‌سازی جلسه…" />}
      </PresentationErrorBoundary>
    );
  }

  if (role === "player") {
    return (
      <PresentationErrorBoundary key={`player-${roomId ?? "unknown"}`}>
        {renderPlayer()}
      </PresentationErrorBoundary>
    );
  }

  return <Waiting />;
}

class PresentationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[PresentationErrorBoundary] Runtime error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <h2 className="text-xl font-bold">Presentation Error</h2>
          <p className="mt-2 text-sm text-white/70">
            A runtime error occurred. Please reload to recover the session.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

/* ---------------- Live HTTP/SSE synchronization ---------------- */
function LiveMessageHandler() {
  const { snapshot, roster, lastEvent } = useLiveSession();
  const { applyLiveSnapshot, applyLiveEvent } = useServerData();

  useEffect(() => {
    if (!snapshot) return;
    applyLiveSnapshot(snapshot, roster);
  }, [snapshot, roster, applyLiveSnapshot]);

  useEffect(() => {
    if (!lastEvent) return;
    applyLiveEvent(lastEvent);
  }, [lastEvent, applyLiveEvent]);

  return null;
}
