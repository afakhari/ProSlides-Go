import { useState, useEffect, useMemo } from "react";
import TopBar from "../../../components/TopBar";
import QRSidebar from "../../../components/QRSidebar";
import Footer from "../../../components/Footer";
import { getColorForUser, isLightColor } from "../../../lib/colorUtils";
import { resolveQuestionTimer } from "../utils/questionTimerSync";
// LeaderboardModal was removed; modal UI now lives on Manager LeaderBoard page
import { useLiveSession } from "../../../hooks/useLiveSession";
import { useServerData } from "../../../hooks/useServerData";
import { EMPTY_FOOTER_STATS } from "../../../modules/live/model/runtimeDefaults";
// import { useLocation, useNavigate } from "react-router-dom";

const debugLog = (...args) => {
  if (import.meta.env.DEV) console.log(...args);
};

const EMPTY_QUESTION = {
  slide_type: 1,
  question_id: null,
  question_text: "",
  question_time: 0,
  max_point: 0,
  min_point: 0,
  image_url: "",
  options: [],
};

const normalizeQuestion = (question) => {
  if (!question || typeof question !== "object") {
    return EMPTY_QUESTION;
  }
  return {
    ...EMPTY_QUESTION,
    ...question,
    options: Array.isArray(question.options) ? question.options : [],
  };
};

export default function ManagerPickAnswerQuestion({
  roomId,
  currentSlide = 1,
  totalSlides = 5,
  quiz,
  isRemoteReady,
  onEndGame,
}) {
  const { isConnected, sendNavigation, sendEnd } =
    useLiveSession();
  const {
    questionResults,
    modalLeaderboardResults,
    currentQuestion: liveCurrentQuestion,
  } = useServerData();

  // Calculate current question number and details from currentSlide
  // const questionNumber = currentQuestionIndex + 1;
  // const totalQuestions = QuizSetup.slides.length;

  const currentQuestion = normalizeQuestion(
    isRemoteReady ? quiz?.slides?.[currentSlide - 1] : null
  );
  const liveQuestionMatchesSlide =
    liveCurrentQuestion?.question_id != null &&
    currentQuestion.question_id != null &&
    String(liveCurrentQuestion.question_id) ===
      String(currentQuestion.question_id);
  const timerSourceQuestion =
    liveQuestionMatchesSlide && typeof liveCurrentQuestion === "object"
      ? {
          ...currentQuestion,
          ...liveCurrentQuestion,
          // Keep normalized options from slide for stable rendering/mapping.
          options: currentQuestion.options,
        }
      : currentQuestion;
  const timerSyncQuestion = useMemo(
    () => ({
      question_id: timerSourceQuestion.question_id,
      run_id: timerSourceQuestion.run_id,
      question_time: timerSourceQuestion.question_time,
      remaining_time: timerSourceQuestion.remaining_time,
      remaining_seconds: timerSourceQuestion.remaining_seconds,
      time_left: timerSourceQuestion.time_left,
      time_left_seconds: timerSourceQuestion.time_left_seconds,
      started_at: timerSourceQuestion.started_at,
      start_time: timerSourceQuestion.start_time,
      question_started_at: timerSourceQuestion.question_started_at,
      question_start_time: timerSourceQuestion.question_start_time,
    }),
    [
      timerSourceQuestion.question_id,
      timerSourceQuestion.run_id,
      timerSourceQuestion.question_time,
      timerSourceQuestion.remaining_time,
      timerSourceQuestion.remaining_seconds,
      timerSourceQuestion.time_left,
      timerSourceQuestion.time_left_seconds,
      timerSourceQuestion.started_at,
      timerSourceQuestion.start_time,
      timerSourceQuestion.question_started_at,
      timerSourceQuestion.question_start_time,
    ]
  );
  const questionOptions = currentQuestion.options;
  const currentOptionCount = questionOptions.length;
  const options = questionOptions.map((opt) => opt.option_text);

  // Ù¾ÛŒØ¯Ø§ Ú©Ø±Ø¯Ù† Ù‡Ù…Ù‡ Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§ÛŒ ØµØ­ÛŒØ­ (Ù†Ù‡ ÙÙ‚Ø· ÛŒÚ©ÛŒ)
  const correctIndexes =
    questionOptions.reduce((arr, opt, idx) => {
      if (opt.answer === true) arr.push(idx);
      return arr;
    }, []);

  const [selected] = useState(null);
  const [voted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [timer, setTimer] = useState(currentQuestion.question_time);
  const [votes, setVotes] = useState(new Array(currentOptionCount).fill(0));
  const [hasReceivedResults, setHasReceivedResults] = useState(false);
  const [awaitingServerResults, setAwaitingServerResults] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [questionAnchorStartMs, setQuestionAnchorStartMs] = useState(Date.now());
  // const navigate = useNavigate();

  // Reset state when slide changes (new question)
  useEffect(() => {
    if (!isRemoteReady) return;
    const resolvedTimer = resolveQuestionTimer({
      question: timerSyncQuestion,
      roomId,
      role: "manager",
    });
    debugLog("[PickAnswerQuestion] Slide changed to:", currentSlide);
    debugLog("[PickAnswerQuestion] Resetting state...");
    setShowResults(false);
    setVotes(new Array(currentOptionCount).fill(0));
    setTimer(resolvedTimer.remainingSeconds);
    setQuestionAnchorStartMs(resolvedTimer.anchorStartMs);
    setHasReceivedResults(false);
    setAwaitingServerResults(false);
  }, [
    currentSlide,
    currentOptionCount,
    timerSyncQuestion,
    currentQuestion.question_time,
    roomId,
    isRemoteReady,
  ]);

  // Update votes from questionResults in ServerDataContext
  useEffect(() => {
    // Support both 'options' and 'optionsResult' field names
    const resultsArray =
      questionResults?.optionsResult || questionResults?.options;

    if (
      questionResults &&
      resultsArray &&
      resultsArray.length > 0 &&
      currentQuestion.question_id != null
    ) {
      debugLog(
        "[PickAnswerQuestion] Checking questionResults:",
        questionResults
      );
      debugLog(
        "[PickAnswerQuestion] Current question_id:",
        currentQuestion.question_id
      );

      // Match question_id (handle both string and number comparisons)
      const questResultId = String(questionResults.question_id);
      const currentQId = String(currentQuestion.question_id);

      if (questResultId === currentQId) {
        debugLog(
          "[PickAnswerQuestion] Question IDs match! Updating votes..."
        );

        // Use server results directly (do NOT add to mock/initial data)
        const newVotes = questionOptions.map((option) => {
          // Get server data - use String comparison for option_id
          const serverResult = resultsArray.find(
            (s) => String(s.option_id) === String(option.option_id)
          );
          const serverVote = serverResult
            ? serverResult.number_of_submits ??
              serverResult.number_of_submit ??
              0
            : 0;

          debugLog(
            `[PickAnswerQuestion] Option ${option.option_id}: server=${serverVote}`
          );

          return serverVote;
        });

        debugLog(
          "[PickAnswerQuestion] Votes from questionResults:",
          newVotes
        );
        setVotes(newVotes);
        setShowResults(true);
        setHasReceivedResults(true);
        setAwaitingServerResults(false);
      } else {
        debugLog(
          "[PickAnswerQuestion] Question IDs don't match. Ignoring old results."
        );
      }
    }
  }, [questionResults, questionOptions, currentQuestion.question_id]);

  // Handle navigation and update server data
  const handleNext = async () => {
    const currentDefinition = quiz?.slides?.[currentSlide - 1];
    const nextSlide = quiz?.slides?.[currentSlide];
    if (!currentDefinition?.show_leaderboard_after && !nextSlide) {
      if (await sendEnd()) onEndGame?.();
      return;
    }
    const ok = await sendNavigation(
      "next",
      currentDefinition?.show_leaderboard_after ? {} : { slide: nextSlide },
    );
    if (!ok) return;

  };

  const handleEnd = async () => {
    debugLog("[PickAnswerQuestion] Sending end command to server");
    if (!(await sendEnd())) return;
    if (onEndGame) onEndGame();
  };

  // Debug: Log state changes
  useEffect(() => {
    debugLog("[PickAnswerQuestion] State update:", {
      showResults,
      votes,
      totalVotes: votes.reduce((sum, v) => sum + v, 0),
      timer,
    });
  }, [showResults, votes, timer]);

  // ØªØ§ÛŒÙ…Ø±
  useEffect(() => {
    if (!isRemoteReady) return; // don't start timer until remote quiz is ready
    if (showResults) {
      debugLog(
        "[PickAnswerQuestion] Timer skipped - results already showing"
      );
      return;
    }

    debugLog(
      "[PickAnswerQuestion] Starting timer for",
      timerSyncQuestion.question_time,
      "seconds"
    );

    const interval = setInterval(() => {
      const elapsed = (Date.now() - questionAnchorStartMs) / 1000;
      const left = Math.max(0, timerSyncQuestion.question_time - elapsed);
      setTimer(left);
      if (left <= 0) {
        clearInterval(interval);
        if (!hasReceivedResults) {
          setAwaitingServerResults(true);
        }
      }
    }, 250);

    return () => {
      debugLog("[PickAnswerQuestion] Cleaning up timer");
      clearInterval(interval);
    };
  }, [
    showResults,
    currentSlide,
    timerSyncQuestion.question_time,
    questionAnchorStartMs,
    questionOptions,
    hasReceivedResults,
    isRemoteReady,
  ]);

  // Calculate dynamic background style from quiz data
  const backgroundStyle = {
    backgroundImage: quiz?.background?.image
      ? `url('${quiz.background.image}')`
      : "none",
    backgroundColor: quiz?.background?.color || "#1e1e2e",
  };
  const textColor =
    quiz?.text_color || quiz?.background?.text_color || "#111827";
  const textMutedColor =
    textColor.toLowerCase() === "#111827"
      ? "rgba(17, 24, 39, 0.7)"
      : "rgba(255, 255, 255, 0.7)";
  const needsOverlay =
    !!quiz?.background?.image ||
    isLightColor(quiz?.background?.color || "#1e1e2e");

  return (
    <div
      className="relative min-h-screen bg-cover bg-center bg-no-repeat flex flex-col justify-around items-center font-semibold"
      style={{
        ...backgroundStyle,
        "--quiz-text": textColor,
        "--quiz-text-muted": textMutedColor,
      }}
    >
      {needsOverlay && (
        <div className="pointer-events-none absolute inset-0 bg-black/45" />
      )}
      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-around">
      <TopBar
        isConnected={isConnected}
        accessCode={quiz?.access_code}
        showQRButton={true}
        onQRToggle={setShowQRModal}
        isQROpen={showQRModal}
      />

      <QRSidebar
        accessCode={quiz?.access_code}
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
      />

      <div
        className={`h-screen flex flex-col items-center transition-all duration-300 pt-20 pb-24 overflow-hidden ${
          showQRModal ? "ml-[20%] w-[80%]" : "ml-0 w-full"
        }`}
      >
        {/* Live connection status */}
        {isRemoteReady ? (
          <>
            {/* ØµÙˆØ±Øª Ø³ÙˆØ§Ù„ - Ø¨Ø§Ù„Ø§ Ø¨Ø§ ÙØ§ØµÙ„Ù‡ Ø¨ÛŒØ´ØªØ± */}
            <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-[color:var(--quiz-text)] mb-4 mt-8 text-center px-4 shrink-0">
              {currentQuestion.question_text}
            </h2>

            {/* ØªØ§ÛŒÙ…Ø± */}
            {!showResults && timer > 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-8xl font-bold text-[color:var(--quiz-text)] pointer-events-none z-10">
                {Math.ceil(timer)}
              </div>
            )}
            {awaitingServerResults && (
              <div className="absolute top-24 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 text-sm text-[color:var(--quiz-text)]">
                Waiting for server results...
              </div>
            )}

            {/* Ø¨Ø®Ø´ Ø§ØµÙ„ÛŒ - Ø¹Ú©Ø³ Ø³ÙˆØ§Ù„ Ø³Ù…Øª Ú†Ù¾ØŒ Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§ Ø³Ù…Øª Ø±Ø§Ø³Øª */}
            <div className="flex flex-1 w-full min-h-0 px-4 gap-6">
              {/* Ø¹Ú©Ø³ Ø³ÙˆØ§Ù„ - Ø³Ù…Øª Ú†Ù¾ */}
              {currentQuestion.image_url && (
                <div className="flex items-center justify-center w-1/4 shrink-0">
                  <img
                    src={currentQuestion.image_url}
                    alt="Question"
                    className="max-h-full max-w-full rounded-xl shadow-lg object-contain"
                  />
                </div>
              )}

              {/* Ù†Ù…ÙˆØ¯Ø§Ø± Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§ - Ø³Ù…Øª Ø±Ø§Ø³Øª */}
              <div
                className={`flex justify-around items-end flex-1 min-h-0 ${
                  !currentQuestion.image_url ? "w-full" : ""
                }`}
              >
                {questionOptions.map((opt, index) => {
                  const isCorrect = correctIndexes.includes(index);
                  const isSelected = index === selected;
                  const totalVotes = votes.reduce((sum, v) => sum + v, 0);
                  // Ø§Ø±ØªÙØ§Ø¹ ÙÙ‚Ø· ÙˆÙ‚ØªÛŒ Ù†ØªØ§ÛŒØ¬ Ø±Ø³ÛŒØ¯Ù‡ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒØ´Ù‡
                  const height =
                    hasReceivedResults && totalVotes > 0
                      ? (votes[index] / totalVotes) * 100
                      : 0;
                  const hasImage = opt.image_url && opt.image_url.length > 0;

                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center justify-end w-1/5 h-full"
                    >
                      {/* ØªØ¹Ø¯Ø§Ø¯ Ø±Ø§ÛŒ - ÙÙ‚Ø· Ø¨Ø¹Ø¯ Ø§Ø² Ø¯Ø±ÛŒØ§ÙØª Ù†ØªØ§ÛŒØ¬ */}
                      {hasReceivedResults && (
                        <div className="mb-1 text-center text-2xl lg:text-4xl text-[color:var(--quiz-text)] font-semibold">
                          {votes[index]}
                        </div>
                      )}

                      {/* ØªØµÙˆÛŒØ± Ú¯Ø²ÛŒÙ†Ù‡ - Ú†Ø³Ø¨ÛŒØ¯Ù‡ Ø¨Ù‡ Ø¨Ø§Ù„Ø§ÛŒ Ù†ÙˆØ§Ø± Ø¨Ø§ Ø¹Ø±Ø¶ ÛŒÚ©Ø³Ø§Ù† */}
                      {hasImage && (
                        <img
                          src={opt.image_url}
                          alt={opt.option_text}
                          className="w-3/4 h-auto max-h-40 rounded-t-lg object-contain"
                        />
                      )}

                      {/* Ù†ÙˆØ§Ø± Ù†Ù…ÙˆØ¯Ø§Ø± - ÙÙ‚Ø· Ø¨Ø¹Ø¯ Ø§Ø² Ø¯Ø±ÛŒØ§ÙØª Ù†ØªØ§ÛŒØ¬ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒØ´Ù‡ */}
                      <div
                        className={`w-3/4 transition-all duration-1000 ${
                          hasImage ? "rounded-b-lg" : "rounded-t-lg"
                        }

                        ${
                          hasReceivedResults
                            ? isCorrect
                              ? "bg-green-500"
                              : "bg-red-500"
                            : "bg-transparent"
                        }
                        ${
                          isSelected && !isCorrect ? "ring-2 ring-pink-800" : ""
                        }`}
                        style={{
                          height: hasReceivedResults
                            ? `${Math.max(height, 5)}%`
                            : "0%",
                        }}
                      ></div>

                      {/* Ù…ØªÙ† Ú¯Ø²ÛŒÙ†Ù‡ */}
                      <p className="mt-2 text-[color:var(--quiz-text)] text-xl lg:text-2xl font-semibold text-center">
                        {opt.option_text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center w-full flex-1 min-h-0 mb-4 px-4">
          <div className="text-[color:var(--quiz-text-muted)] text-2xl">Loading quizâ€¦</div>
          </div>
        )}

        {/* Ø¯Ú©Ù…Ù‡â€ŒÙ‡Ø§ÛŒ Ø±Ø£ÛŒ Ø¯Ø§Ø¯Ù† */}
        {/* {!voted && !showResults && (
          <div className="flex flex-wrap justify-center gap-4">
            {options.map((opt, index) => (
              <button
                key={index}
                onClick={() => handleVote(index)}
                className="bg-pink-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-pink-600 transition shadow-md"
              >
                {opt}
              </button>
            ))}
          </div>
        )} */}

        {voted && !showResults && (
          <p className="mt-6 text-pink-700 font-medium">
            You voted for <b>{options[selected]}</b>
          </p>
        )}
      </div>

      <Footer
        currentSlide={currentSlide}
        totalSlides={totalSlides}
        stats={EMPTY_FOOTER_STATS}
        showQRButton={true}
        onQRToggle={setShowQRModal}
        isQROpen={showQRModal}
        onShowLeaderboard={() => setShowLeaderboard(true)}
        onNext={handleNext}
        onEnd={handleEnd}
        endOnLastSlide={false}
        textColor={textColor}
      />

      {/* Leaderboard Modal using type 12 data */}
      {showLeaderboard && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            className="bg-gray-900 rounded-xl p-8 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">ðŸ†</span>
                <div>
                  <h2 className="text-white text-3xl font-bold">Leaderboard</h2>
                  <p className="text-gray-400 text-sm">
                    {(modalLeaderboardResults || []).length} players
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLeaderboard(false)}
                className="text-white hover:text-gray-300 text-3xl border-none bg-transparent cursor-pointer leading-none"
              >
                Ã—
              </button>
            </div>

            <div className="space-y-3">
              {(() => {
                const modalPlayers = modalLeaderboardResults || [];
                debugLog(
                  "[PickAnswerQuestion] Modal players:",
                  modalPlayers
                );
                const maxScore = Math.max(
                  ...modalPlayers.map((p) => p.total_points || 0),
                  0
                );
                debugLog("[PickAnswerQuestion] Max score:", maxScore);

                // Ø¯Ø±ØµØ¯ Ø§Ù…ØªÛŒØ§Ø² Ù†Ø³Ø¨Øª Ø¨Ù‡ Ù†ÙØ± Ø§ÙˆÙ„
                const calcPercent = (score) => {
                  if (maxScore === 0) return 0;
                  return (score / maxScore) * 100;
                };

                return modalPlayers.map((player) => {
                  const score = player.total_points || 0;
                  const barWidth = calcPercent(score);
                  const hasScore = score > 0;
                  const playerColor = getColorForUser(player.user_id);

                  return (
                    <div
                      key={player.user_id}
                      className="flex items-center gap-4 relative"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                        style={{
                          backgroundColor: playerColor,
                          boxShadow: `0 4px 12px ${playerColor}60`,
                        }}
                      >
                        {player.rank}
                      </div>
                      <div className="flex-1 relative h-16 flex items-center">
                        {hasScore ? (
                          <div
                            className="rounded-lg h-16 transition-all duration-1000 flex items-center px-4 gap-3"
                            style={{
                              backgroundColor: playerColor,
                              width: `${Math.max(barWidth, 15)}%`,
                              boxShadow: `0 4px 15px ${playerColor}80, 0 2px 8px ${playerColor}60`,
                            }}
                          >
                            <span className="text-2xl">{player.character}</span>
                            <span className="text-white font-semibold text-lg">
                              {player.name}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-4">
                            <span className="text-2xl">{player.character}</span>
                            <span className="text-white font-semibold text-lg">
                              {player.name}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-white font-bold text-xl shrink-0 w-20 text-right">
                        {Math.round(score)}p
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}


