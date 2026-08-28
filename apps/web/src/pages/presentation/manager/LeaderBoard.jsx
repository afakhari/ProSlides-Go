import React, { useState, useEffect, useMemo } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import TopBar from "../../../components/TopBar";
import QRSidebar from "../../../components/QRSidebar";
import Footer from "../../../components/Footer";
import { getColorForUser, isLightColor } from "../../../lib/colorUtils";
// LeaderboardModal component was inlined into this page per request
import { useLiveSession } from "../../../hooks/useLiveSession";
import { useServerData } from "../../../hooks/useServerData";
import { createNavigationState, EMPTY_FOOTER_STATS } from "../../../modules/live/model/runtimeDefaults";

const debugLog = (...args) => {
  if (import.meta.env.DEV) console.log(...args);
};

function ManagerLeaderBoard({
  onNext,
  currentSlide = 1,
  totalSlides = 3,
  quiz,
  getLeaderboardForQuestion,
  onEndGame,
}) {
  // Server projections come from useServerData; live commands come from useLiveSession.
  const { isConnected, sendNavigation, sendEnd, participantCount, hasMoreRoster, isRosterLoading, loadMoreRoster } = useLiveSession();
  const {
    managerLastLeaderboard,
    leaderboardResults,
    modalLeaderboardResults,
  } = useServerData();

  // Ø­Ø°Ù state Ø¯Ø§Ø®Ù„ÛŒ Ùˆ ÙÙ‚Ø· Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø§Ø² Ø¯Ø§Ø¯Ù‡ context

  // Get the question ID from the previous slide (leaderboard usually comes after a question)
  // NOTE: slide indices are 0-based, but currentSlide appears to be 1-based
  // When on a leaderboard slide, the question before it is at currentSlide - 2 (0-based).
  const questionSlideIndex = currentSlide - 2;
  const questionSlide =
    questionSlideIndex >= 0 && quiz?.slides
      ? quiz.slides[questionSlideIndex]
      : null;
  const previousQuestionId = questionSlide?.question_id;

  // Try to get leaderboard for this specific question, or use current leaderboardResults
  const leaderboardForThisQuestion =
    previousQuestionId && typeof getLeaderboardForQuestion === "function"
      ? getLeaderboardForQuestion(previousQuestionId)
      : null;
  // Ù‡Ù…ÛŒØ´Ù‡ Ø¢Ø®Ø±ÛŒÙ† Ù„ÛŒØ¯Ø±Ø¨Ø±Ø¯ Ù…Ø¹ØªØ¨Ø± Ø±Ø§ Ù†Ú¯Ù‡ Ø¯Ø§Ø± Ùˆ Ø§Ú¯Ø± Ø¯Ø§Ø¯Ù‡ Ø¬Ø¯ÛŒØ¯ Ù†ÛŒØ§Ù…Ø¯ØŒ Ù¾Ø§Ú© Ù†Ú©Ù†
  // Ø§Ú¯Ø± Ù‡ÛŒÚ† Ø¯Ø§Ø¯Ù‡â€ŒØ§ÛŒ Ø¨Ø±Ø§ÛŒ Ø§Ø³Ù„Ø§ÛŒØ¯ ÙØ¹Ù„ÛŒ Ù†Ø¨ÙˆØ¯ØŒ Ø¢Ø®Ø±ÛŒÙ† Ù„ÛŒØ¯Ø±Ø¨Ø±Ø¯ Ù…Ø¹ØªØ¨Ø± Ø±Ø§ Ù†Ù…Ø§ÛŒØ´ Ø¨Ø¯Ù‡
  let dataToUse = leaderboardForThisQuestion || leaderboardResults;

  // Ø§Ú¯Ø± Ø¯Ø§Ø¯Ù‡ ÙØ¹Ù„ÛŒ Ø®Ø§Ù„ÛŒ Ø§Ø³ØªØŒ Ø§Ø² Ø¢Ø®Ø±ÛŒÙ† Ø¯Ø§Ø¯Ù‡ Ù…Ø¹ØªØ¨Ø± Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù†
  if (
    !dataToUse ||
    (Array.isArray(dataToUse) && dataToUse.length === 0) ||
    (dataToUse.results && dataToUse.results.length === 0)
  ) {
    if (
      managerLastLeaderboard &&
      ((Array.isArray(managerLastLeaderboard) &&
        managerLastLeaderboard.length > 0) ||
        (managerLastLeaderboard.results &&
          managerLastLeaderboard.results.length > 0))
    ) {
      dataToUse = managerLastLeaderboard;
    }
  }

  // ÙÙ‚Ø· Ø¯Ø§Ø¯Ù‡ Ø±Ø§ Ø§Ø² context Ù…ÛŒâ€ŒÚ¯ÛŒØ±ÛŒÙ… Ùˆ Ù‡ÛŒÚ† ÙˆÙ‚Øª setPlayers Ù†Ù…ÛŒâ€ŒØ²Ù†ÛŒÙ…
  const results = useMemo(
    () => dataToUse?.results || dataToUse || [],
    [dataToUse]
  );

  debugLog("[ManagerLeaderBoard] Render Cycle:");
  debugLog("  - leaderboardResults:", leaderboardResults);
  debugLog("  - managerLastLeaderboard:", managerLastLeaderboard);
  debugLog("  - dataToUse:", dataToUse);
  debugLog("  - derived results:", results);

  // Ù‡Ù…ÛŒØ´Ù‡ Ø§Ø² rank Ø³Ø±ÙˆØ± Ø§Ø³ØªÙØ§Ø¯Ù‡ Ú©Ù† Ùˆ Ù‡ÛŒÚ†ÙˆÙ‚Øª index Ø±Ø§ Ø¬Ø§ÛŒÚ¯Ø²ÛŒÙ† Ù†Ú©Ù†
  const players = useMemo(
    () =>
      Array.isArray(results)
        ? results.map((user) => ({
            user_id: user.user_id,
            name: user.name,
            character: user.character,
            color: getColorForUser(user.user_id),
            rank: user.rank,
            total_points: user.total_points || 0,
            new_points: user.new_points ?? null,
          }))
        : [],
    [results]
  );

  debugLog("[ManagerLeaderBoard DEBUG] players:", players);

  // Calculate current question number and details from currentSlide
  const currentQuestionIndex = currentSlide - 1;
  const [hovered, setHovered] = useState(null);
  const [hiddenNames, setHiddenNames] = useState([]);
  const [displayedPlayers, setDisplayedPlayers] = useState([]);
  const [animateBars, setAnimateBars] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [_navigationData, setNavigationData] = useState(
    createNavigationState(5, null, null)
  );

  // Ù‡ÛŒÚ† Ù¾ÛŒØ§Ù… Ù…Ø³ØªÙ‚ÛŒÙ…ÛŒ Ø§Ø² Ø³Ø±ÙˆØ± Ù¾Ø±Ø¯Ø§Ø²Ø´ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯ØŒ ÙÙ‚Ø· Ø¯Ø§Ø¯Ù‡ context Ø§Ø³ØªÙØ§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯

  // Handle navigation and update server data
  const handleNext = async () => {
    const newNavigationData = createNavigationState(
      5,
      "next",
      currentQuestionIndex
    );
    setNavigationData(newNavigationData);
    debugLog(
      "[LeaderBoard] Navigation data to send to server:",
      newNavigationData
    );

    const nextSlide = quiz?.slides?.[currentSlide];
    if (!(await sendNavigation("next", { slide: nextSlide }))) return;

    if (onNext) onNext();
  };

  const handleEnd = async () => {
    debugLog("[LeaderBoard] Sending end command to server");
    if (!(await sendEnd())) return;
    if (onEndGame) onEndGame();
  };

  const handleToggleBlur = (id) => {
    setHiddenNames((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const maxScore =
    players.length > 0 ? Math.max(...players.map((p) => p.total_points)) : 0;
  const minScore = 0;

  const calcPercent = (score) => {
    if (maxScore <= minScore) return score > 0 ? 100 : 0;
    const percent = ((score - minScore) / (maxScore - minScore)) * 99 + 1;
    return Math.max(percent, 1);
  };

  useEffect(() => {
    // Ensure players have colors and are displayed as received from server
    const processedPlayers = players.map((p) => ({
      ...p,
      color: p.color || "#6366f1",
    }));
    setDisplayedPlayers(processedPlayers);

    // Trigger animation
    setAnimateBars(false);
    const t = setTimeout(() => {
      setAnimateBars(true);
    }, 500);

    return () => clearTimeout(t);
  }, [players]);

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
        className={`min-h-screen flex flex-col justify-around items-center transition-all duration-300 pt-20 pb-20 ${
          showQRModal ? "ml-[20%] w-[80%]" : "ml-0 w-full"
        }`}
      >
        <main className="flex-1 w-full overflow-hidden min-h-0 pb-16">
          <section className="flex-1 w-full flex flex-col items-center min-h-0 px-4">
            {/* Live connection status */}
            {/* Title and player count */}
            <div className="text-center w-full">
              <h2 className="text-6xl text-[color:var(--quiz-text)] font-bold mb-4">
                Leaderboard
              </h2>
              <p className="text-[color:var(--quiz-text-muted)] text-lg mt-2">
                {participantCount} players
              </p>
            </div>

            {/* Scrollable players list â€” only this area will scroll when long */}
            <div className="mt-6 flex-1 w-full max-w-4xl">
              {/* Scrollable players list â€” only this area will scroll when long */}
              <div
                className="mt-2 flex-1 overflow-auto w-full min-h-0 no-scrollbar"
                style={{ maxHeight: "calc(100vh - 260px)" }}
              >
                {players.length === 0 ? (
                  <div className="text-[color:var(--quiz-text-muted)] text-center py-6">
                    Waiting for leaderboard dataâ€¦
                  </div>
                ) : (
                  <ul className="space-y-4 w-full flex flex-col items-stretch py-2">
                    <AnimatePresence>
                      {displayedPlayers.map((p) => {
                        const isHidden = hiddenNames.includes(p.rank);
                        const hasScore = p.total_points > 0;
                        const widthPercent = hasScore
                          ? calcPercent(p.total_points)
                          : 0;

                        return (
                          <Motion.li
                            key={p.user_id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{
                              type: "spring",
                              stiffness: 120,
                              damping: 18,
                            }}
                            className="flex justify-start items-center relative w-[90%] max-w-3xl mx-auto"
                            onMouseEnter={() => setHovered(p.rank)}
                            onMouseLeave={() => setHovered(null)}
                          >
                            {/* Rank */}
                            <div
                              className="text-lg font-bold w-10 h-10 flex items-center justify-center rounded-full mr-3"
                              style={{
                                backgroundColor: p.color,
                                color: "#fff",
                                boxShadow: `0 4px 12px ${p.color}60`,
                              }}
                            >
                              {p.rank}
                            </div>

                            {/* Fixed-width translucent track */}
                            <div className="relative overlay-hidden bg-white/10 w-full h-14 mr-3 rounded-lg">
                              {/* Colored fill - only show if score > 0 */}
                              {hasScore && (
                                <Motion.div
                                  className={`absolute left-0 top-0 h-full z-10 rounded-lg`}
                                  style={{
                                    backgroundColor: p.color,
                                    boxShadow: `0 4px 15px ${p.color}80, 0 2px 8px ${p.color}60`,
                                  }}
                                  initial={{ width: 0 }}
                                  animate={{
                                    width: animateBars ? `${widthPercent}%` : 0,
                                  }}
                                  transition={{
                                    duration: 1.3,
                                    ease: "easeOut",
                                  }}
                                />
                              )}

                              {/* Content on top */}
                              <div className="relative z-20 flex items-center px-4 py-3 gap-4">
                                <div className="player-avatar text-2xl">
                                  {p.character}
                                </div>

                                <div className="flex items-center space-x-3">
                                  <div
                                    className={`text-[color:var(--quiz-text)] font-medium transition-all duration-200 ${
                                      isHidden ? "blur-sm select-none" : ""
                                    }`}
                                  >
                                    {isHidden ? "****" : p.name}
                                  </div>

                                  {hovered === p.rank && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleToggleBlur(p.rank)}
                                        className="bg-white/90 text-gray-800 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                      >
                                        ðŸ‘ï¸
                                      </button>
                                      {/* <button
                                        onClick={() =>
                                          handleClick("âœï¸ Edit", p.name)
                                        }
                                        className="bg-white/90 text-blue-600 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                      >
                                        âœï¸
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleClick("ðŸ“ž Call", p.name)
                                        }
                                        className="bg-white/90 text-green-600 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                      >
                                        ðŸ“ž
                                      </button> */}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Score */}
                            <div className="relative w-[10%] text-[color:var(--quiz-text)] font-semibold ml-3">
                              {Math.round(p.total_points)}p{" "}
                              {Number.isFinite(p.new_points) && (
                                <span className="text-[color:var(--quiz-text-muted)] text-sm">
                                  +{Math.round(p.new_points)}
                                </span>
                              )}
                            </div>
                          </Motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
              {hasMoreRoster && (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadMoreRoster()}
                    disabled={isRosterLoading}
                    className="rounded-lg border border-white/30 px-4 py-2 text-sm text-[color:var(--quiz-text)] disabled:opacity-50"
                  >
                    {isRosterLoading ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </div>
          </section>
          {/* <button

          className="mt-[25px] mx-[10px] w-[calc(100%-20px)] p-[14px] border-none rounded-[10px]  font-bold cursor-pointer transition-all duration-300 text-2xl bg-white text-[#6c2bd9] disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => navigate("/PollPage")}
        >
          leader board
        </button> */}
        </main>

        <Footer
          currentSlide={currentSlide}
          totalSlides={totalSlides}
          stats={EMPTY_FOOTER_STATS}
          showQRButton={true}
          onQRToggle={setShowQRModal}
          isQROpen={showQRModal}
          onShowLeaderboard={() => setShowLeaderboardModal(true)}
          onNext={handleNext}
          onEnd={handleEnd}
          textColor={textColor}
        />

        {/* Inlined Leaderboard Modal (replaces removed shared component) */}
        {showLeaderboardModal && (
          <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            onClick={() => setShowLeaderboardModal(false)}
          >
            <div
              className="bg-gray-900 rounded-xl p-8 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">ðŸ†</span>
                  <div>
                    <h2 className="text-white text-3xl font-bold">
                      Leaderboard
                    </h2>
                    <p className="text-gray-400 text-sm">
                      {(modalLeaderboardResults || []).length} players
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLeaderboardModal(false)}
                  className="text-white hover:text-gray-300 text-3xl border-none bg-transparent cursor-pointer leading-none"
                >
                  Ã—
                </button>
              </div>

              <div className="space-y-3">
                {(() => {
                  const modalPlayers = modalLeaderboardResults || [];
                  debugLog("[LeaderBoard] Modal players:", modalPlayers);
                  const maxScore = Math.max(
                    ...modalPlayers.map((p) => p.total_points || 0),
                    0
                  );
                  debugLog("[LeaderBoard] Max score:", maxScore);

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
                              <span className="text-2xl">
                                {player.character}
                              </span>
                              <span className="text-white font-semibold text-lg">
                                {player.name}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 px-4">
                              <span className="text-2xl">
                                {player.character}
                              </span>
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
    </div>
  );
}

export default ManagerLeaderBoard;

