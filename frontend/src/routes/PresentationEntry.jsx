import { useState, useEffect, lazy } from "react";
import { useParams } from "react-router-dom";

import { QuizSetup } from "../data/mockData";
import { WebSocketProvider } from "../contexts/WebSocketContext";
import { ServerDataProvider } from "../contexts/ServerDataContext";
import { useServerData } from "../hooks/useServerData";
import { useWebSocket } from "../hooks/useWebSocket";
import { AudioProvider, useAudio } from "../contexts/AudioContext";
import { apiFetch } from "../utils/apiFetch";

import Waiting from "../pages/loading/LoadingPage";

const ManagerJoinPage = lazy(() =>
  import("../pages/presentation/manager/JoinPage")
);
const ManagerPickAnswerQuestion = lazy(() =>
  import("../pages/presentation/manager/PickAnswerQuestion")
);
const ManagerLeaderBoard = lazy(() =>
  import("../pages/presentation/manager/LeaderBoard")
);
const FinalLeaderboard = lazy(() =>
  import("../pages/presentation/manager/FinalLeaderboard")
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

  useEffect(() => {
    let mounted = true;
    const resolveCode = async () => {
      try {
        const res = await apiFetch(
          `/quizzes/resolve-access-code/?access_code=${encodeURIComponent(
            accessCode
          )}`,
          { auth: false }
        );
        const data = await res.json();
        console.log("[AccessCodeResolver] API Response:", data);

        if (!mounted) return;

        if (data.quiz_id) {
          // Access code valid - store quiz_id and show player presentation
          setResolvedData(data);
          setStatus("success");
        } else {
          // Invalid access code
          setStatus("error");
        }
      } catch (err) {
        console.error("[AccessCodeResolver] Error:", err);
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
    return <Waiting message="Joining..." />;
  }

  // Error state
  if (status === "error") {
    return <Waiting message="Invalid access code" />;
  }

  // Success - render player presentation directly (URL stays the same)
  if (status === "success" && resolvedData) {
    return (
      <AudioProvider>
        <WebSocketProvider role="player">
          <AppPresentation
            roomId={String(resolvedData.quiz_id)}
            role="player"
            initialQuizData={resolvedData}
          />
          <WSMessageHandler />
        </WebSocketProvider>
      </AudioProvider>
    );
  }

  return <Waiting />;
}

/* ------------------------ Router Wrapper ------------------------ */
function PresentationRouter() {
  const { roomId, role } = useParams();
  const wsRole = role === "player" ? "player" : "manager";

  return (
    <AudioProvider>
      <WebSocketProvider role={wsRole}>
        <AppPresentation roomId={roomId} role={role} />
        <WSMessageHandler />
      </WebSocketProvider>
    </AudioProvider>
  );
}

/* ------------------------ Main Flow ------------------------ */
function AppPresentation({ roomId, role, initialQuizData }) {
  const [data, setData] = useState({ type: "ManagerJoinPage" });
  const [currentSlide, setCurrentSlide] = useState(1);

  // Fetch full quiz once at top-level and transform to internal shape
  const [remoteQuiz, setRemoteQuiz] = useState(null);

  // Initialize remoteQuiz with initialQuizData if available (for player)
  useEffect(() => {
    if (initialQuizData && role === "player") {
      console.log(
        "[AppPresentation] Initializing player with:",
        initialQuizData
      );

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

      setRemoteQuiz({
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
        if (role === "player" && initialQuizData) {
          console.log(
            "[AppPresentation] Skipping full export fetch for player, using initial data"
          );
          return;
        }

        const res = await apiFetch(`/quizzes/${roomId}/export/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        if (data && Array.isArray(data.slides)) {
          // Transform API format to internal format
          const mappedSlides = data.slides.map((slide) => {
            if (slide.slide_type === 1 && slide.question) {
              const q = slide.question;
              return {
                slide_type: 1,
                slide_id: slide.slide_id,
                question_id: q.question_id,
                question_text: q.text,
                question_title: q.title || "",
                question_time: q.time_limit,
                max_point: q.max_point,
                min_point: q.min_point,
                access_code: q.access_code,
                // New fields from API
                question_type: q.question_type, // "single" or "multiple"
                has_multiple: q.question_type === "multiple",
                image_url: q.image_url || "",
                faster_answers_more_points: q.faster_answers_more_points,
                partial_scoring: q.partial_scoring,
                show_leaderboard_after: slide.show_leaderboard_after,
                // Leaderboard data from API
                leaderboard: slide.leaderboard || [],
                options: (q.options || []).map((opt) => ({
                  option_id: opt.option_id,
                  option_text: opt.text,
                  answer: opt.is_correct,
                  number_of_submits: opt.votes || 0,
                  image_url: opt.image_url || "",
                  order: opt.order,
                })),
              };
            }
            // Content slide or leaderboard slide
            return {
              slide_type: slide.slide_type || 2,
              slide_id: slide.slide_id,
              title: slide.title || "",
              content_text: slide.content_text || "",
              content_image_url: slide.content_image_url || "",
              leaderboard: slide.leaderboard || [],
            };
          });

          // Store quiz metadata as well
          const quizData = {
            quiz_id: data.quiz_id,
            title: data.title,
            access_code: data.access_code || "",
            background: data.background || { color: "#1e1e2e", image: "" },
            music_url: data.music_url || "",
            slides: mappedSlides,
          };

          setRemoteQuiz(quizData);
          console.log("[AppPresentation] remote quiz loaded", quizData);
        }
      } catch (err) {
        console.warn("[AppPresentation] could not load remote quiz", err);
      }
    };
    fetchQuiz();
    return () => {
      mounted = false;
    };
  }, [role, roomId, initialQuizData]);

  const quiz = remoteQuiz ?? QuizSetup;
  const isRemoteReady = !!quiz; // Always ready (remote or fallback)
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
    leaderboardResults,
    questionResults,
    partialQuestionResults,
    modalLeaderboardResults,
  } = useServerData();

  // dYY› U^U,O¦UO manager OO3O¦ U^ type:1 OOý O3OñU^Oñ U.UOƒ?OOñO3O_OO O"UØ U,UOO_OñO"U^OñO_ O"OñU^
  useEffect(() => {
    if (role === "manager" && leaderboardResults) {
      setData({ type: "ManagerLeaderBoard" });
    }
  }, [leaderboardResults, role]);

  /* ------------------ EXACT NEXT/PREVIOUS FROM YOUR CODE ------------------ */

  const handleNext = () => {
    if (data.type === "ManagerJoinPage") {
      setData({ type: "ManagerPickAnswerQuestion" });
    } else {
      if (quiz.slides[currentSlide].slide_type === 3) {
        setData({ type: "ManagerLeaderBoard" });
      } else if (quiz.slides[currentSlide].slide_type === 1) {
        setData({ type: "ManagerPickAnswerQuestion" });
      }
      setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
    }
  };

  const handlePrevious = () => {
    if (data.type === "ManagerPickAnswerQuestion" && currentSlide === 1) {
      setData({ type: "ManagerJoinPage" });
    } else {
      if (quiz.slides[currentSlide - 2].slide_type === 2) {
        setData({ type: "ManagerLeaderBoard" });
      } else if (quiz.slides[currentSlide - 2].slide_type === 1) {
        setData({ type: "ManagerPickAnswerQuestion" });
      }
      setCurrentSlide((prev) => Math.max(prev - 1, 1));
    }
  };

  const handleEndGame = () => {
    setData({ type: "ManagerFinalLeaderboard" });
  };

  /* ---------------- Manager Rendering (EXACT LIKE ORIGINAL) ---------------- */
  const renderManager = () => {
    switch (data.type) {
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
      case "ManagerFinalLeaderboard":
        return (
          <FinalLeaderboard
            leaderboardData={modalLeaderboardResults || leaderboardResults}
            onExit={() => (window.location.href = "/manager/panel")}
          />
        );
      default:
        return <Waiting />;
    }
  };

  /* ---------------- Player Rendering (Server Driven) ---------------- */
  const renderPlayer = () => {
    console.log(
      "[App renderPlayer] currentQuestion:",
      !!currentQuestion,
      "leaderboardResults:",
      !!leaderboardResults,
      "leaderboardResults value:",
      leaderboardResults
    );

    // dYY› OU^U, U,UOO_OñO"U^OñO_ OñU^ U+Uc UcU+ - OU_UØ type:1 OñO3UOO_UØ O"OO'UØOO U,UOO_OñO"U^OñO_ U+O'U^U+ O"O_UØ
    if (leaderboardResults) {
      console.log(
        "[App renderPlayer] Showing PlayerLeaderBoard with",
        (leaderboardResults.results || leaderboardResults)?.length,
        "players"
      );
      return (
        <PlayerLeaderBoard
          roomId={roomId}
          players={leaderboardResults.results || leaderboardResults}
          quiz={quiz}
        />
      );
    }

    // O"O1O_ O3U^OU, OñU^ U+Uc UcU+
    if (currentQuestion) {
      const result = questionResults || partialQuestionResults;
      return (
        <PlayerPickAnswerQuestion
          roomId={roomId}
          question={currentQuestion}
          result={result}
          quiz={quiz}
        />
      );
    }

    return <PlayerJoinPage roomId={roomId} quiz={quiz} />;
  };

  /* ----------- Final Conditional Rendering ----------- */
  if (role === "manager") return renderManager();

  if (role === "player") return renderPlayer();

  return <Waiting />;
}

/* ---------------- WebSocket Handler ---------------- */
function WSMessageHandler() {
  const { lastMessage } = useWebSocket();
  const { processMessage } = useServerData();

  useEffect(() => {
    if (!lastMessage) return;
    processMessage(lastMessage);
  }, [lastMessage, processMessage]);

  return null;
}
