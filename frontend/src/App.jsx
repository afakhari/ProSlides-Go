import {
  BrowserRouter as Router,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import { useState, useEffect } from "react";

import ManagerJoinPage from "./pages/presentation/manager/JoinPage";
import ManagerPickAnswerQuestion from "./pages/presentation/manager/PickAnswerQuestion";
import ManagerLeaderBoard from "./pages/presentation/manager/LeaderBoard";
import ManagerPlayerLeaderBoard from "./pages/presentation/manager/PlayerLeaderBoard";

import PlayerJoinPage from "./pages/presentation/player/JoinPage";
import PlayerPickAnswerQuestion from "./pages/presentation/player/PickAnswerQuestion";
import PlayerLeaderBoard from "./pages/presentation/player/LeaderBoard";

import Waiting from "./pages/loading/LoadingPage";

import AuthPage from "./pages/auth/AuthPage";

import { QuizSetup } from "./data/mockData";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { ServerDataProvider } from "./contexts/ServerDataContext";
import { useServerData } from "./hooks/useServerData";
import { useWebSocket } from "./hooks/useWebSocket";
import { AudioProvider, useAudio } from "./contexts/AudioContext";
import SessionDetail from "./pages/report/SessionDetail";
import { apiFetch } from "./utils/apiFetch";

import HomePage from "./pages/quiz/manager/HomePage";
import EditorPage from "./pages/quiz/manager/EditorPage";

export default function App() {
  return (
    <Router>
      <ServerDataProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/:role/presentation/:roomId"
            element={<PresentationRouter />}
          />
          <Route path="/" element={<AuthPage />} />
          {/* Access code route - resolves access code to quiz_id and redirects to player presentation */}
          <Route path="/:accessCode" element={<AccessCodeResolver />} />
          {/* Manager/Role panel (supports both /manager and any role param) */}
          <Route path="/:role/panel" element={<HomePage />} />
          <Route path="/:role/panel/:roomId" element={<EditorPage />} />
          {/* Catch-all route for any undefined path */}
          <Route path="*" element={<Waiting />} />
          <Route
            path="/:role/panel/:quizId/report"
            element={<SessionDetail />}
          />
        </Routes>
      </ServerDataProvider>
    </Router>
  );

  /* ------------------------ Access Code Resolver ------------------------ */
  function AccessCodeResolver() {
    const { accessCode } = useParams();
    const [status, setStatus] = useState("loading"); // loading | error | success
    const [resolvedQuizId, setResolvedQuizId] = useState(null);

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

          if (!mounted) return;

          if (data.quiz_id) {
            // Access code valid - store quiz_id and show player presentation
            setResolvedQuizId(data.quiz_id);
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
    if (status === "success" && resolvedQuizId) {
      return (
        <AudioProvider>
          <WebSocketProvider role="player">
            <AppPresentation roomId={String(resolvedQuizId)} role="player" />
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
  function AppPresentation({ roomId, role }) {
    const [data, setData] = useState({ type: "ManagerJoinPage" });
    const [currentSlide, setCurrentSlide] = useState(1);

    // Fetch full quiz once at top-level and transform to internal shape
    const [remoteQuiz, setRemoteQuiz] = useState(null);
    useEffect(() => {
      let mounted = true;
      const fetchQuiz = async () => {
        try {
          if (!roomId) return;
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
    }, [roomId]);

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
    } = useServerData();

    // 🟢 وقتی manager است و type:1 از سرور می‌رسد، به لیدربورد برو
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

      // 🟢 اول لیدربورد رو چک کن - اگه type:1 رسیده باشه، لیدربورد نشون بده
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

      // بعد سوال رو چک کن
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
}
