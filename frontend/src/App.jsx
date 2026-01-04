import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

import LandingPage from "./pages/landing/LandingPage";

const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const TeamPage = lazy(() => import("./pages/team/TeamPage"));
const SessionDetail = lazy(() => import("./pages/report/SessionDetail"));
const HomePage = lazy(() => import("./pages/quiz/manager/HomePage"));
const EditorPage = lazy(() => import("./pages/quiz/manager/EditorPage"));
const WaitingPage = lazy(() => import("./pages/loading/LoadingPage"));
const PresentationEntry = lazy(() => import("./routes/PresentationEntry"));

function RouteFallback() {
  return <div className="min-h-screen bg-white" aria-busy="true" />;
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/:role/presentation/:roomId"
            element={<PresentationEntry mode="presentation" />}
          />
          <Route path="/" element={<LandingPage />} />
          {/* Access code route - resolves access code to quiz_id and redirects to player presentation */}
          <Route path="/:accessCode" element={<AccessCodeResolver />} />
          {/* Manager/Role panel (supports both /manager and any role param) */}
          <Route path="/:role/panel" element={<HomePage />} />
          <Route path="/:role/panel/:roomId" element={<EditorPage />} />
          {/* Catch-all route for any undefined path */}
          <Route path="*" element={<NotFoundPage />} />
          <Route
            path="/:role/panel/:quizId/report"
            element={<SessionDetail />}
          />
          <Route path="*" element={<WaitingPage />} />
        </Routes>
      </Suspense>
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

  /* ------------------------ Not Found Page ------------------------ */
  function NotFoundPage() {
    const navigate = useNavigate();
    const [accessCode, setAccessCode] = useState("");

    const handleJoin = (event) => {
      event.preventDefault();
      const trimmed = accessCode.trim();
      if (!trimmed) return;
      navigate(`/${encodeURIComponent(trimmed)}`);
    };

    return (
      <div
        className="min-h-screen text-[#111827]"
        style={{
          fontFamily: '"Outfit", "Segoe UI", sans-serif',
          background:
            "radial-gradient(circle at 10% 15%, rgba(236, 253, 245, 0.7) 0%, transparent 55%), radial-gradient(circle at 90% 10%, rgba(239, 246, 255, 0.7) 0%, transparent 50%), linear-gradient(180deg, #ffffff 0%, #f7fafc 100%)",
        }}
      >
        <div className="border-b border-[#e5e7eb] bg-[#f8fafc]">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-sm text-[#1f2937]">
            <span className="text-[#374151]">Are you a participant?</span>
            <form
              onSubmit={handleJoin}
              className="flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 shadow-[0_6px_14px_rgba(15,23,42,0.05)]"
            >
              <span className="pl-2 text-[11px] font-semibold tracking-[0.14em] text-[#9ca3af]">
                proslides.ir/
              </span>
              <input
                type="text"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="enter code"
                className="w-24 border-none bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#c0c6d0]"
                aria-label="Access code"
              />
              <button
                type="submit"
                className="rounded-full bg-[#111827] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#0f172a]"
              >
                Join
              </button>
            </form>
          </div>
        </div>

        <header className="border-b border-[#e5e7eb] bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-4">


          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-[#111827] font-semibold text-lg before:content-['✱'] before:text-xl"
          >
            ProSlides
          </a>


            <div className="flex items-center gap-3 text-sm font-semibold">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-2 text-[#111827] transition hover:border-[#cbd5f5]"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="rounded-xl bg-[#5b2ecf] px-4 py-2 text-white shadow-[0_12px_28px_rgba(91,46,207,0.25)] transition hover:bg-[#4b25b1]"
              >
                Free sign up
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-5xl items-center gap-12 px-6 pb-24 pt-16 md:grid-cols-[1.1fr_0.9fr]">
          <div className="mx-auto w-full max-w-[420px]">
            <img
              src={notFoundIllustration}
              alt="404 illustration"
              className="w-full"
            />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-semibold text-[#111827] md:text-5xl">
              Oops!
            </h1>
            <p className="mt-4 text-base text-[#6b7280] md:text-lg">
              We couldn&apos;t find that page, but don&apos;t worry, our team is
              already looking for it.
            </p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-8 rounded-2xl bg-[#5b2ecf] px-8 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(91,46,207,0.3)] transition hover:bg-[#4b25b1]"
            >
              Back home
            </button>
          </div>
        </main>
      </div>
    );
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
