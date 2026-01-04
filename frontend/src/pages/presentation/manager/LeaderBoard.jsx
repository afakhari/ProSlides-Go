import React, { useState, useEffect, useMemo } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import TopBar from "../../../components/TopBar";
import QRSidebar from "../../../components/QRSidebar";
import Footer from "../../../components/Footer";
import { getColorForUser } from "../../../lib/colorUtils";
// LeaderboardModal component was inlined into this page per request
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useServerData } from "../../../hooks/useServerData";
import { createNextPrevious, DefaultFooterStats } from "../../../data/mockData";

function ManagerLeaderBoard({
  onNext,
  onPrevious,
  currentSlide = 1,
  totalSlides = 3,
  quiz,
  getLeaderboardForQuestion,
  onEndGame,
}) {
  // فقط داده‌های سرور را از useServerData بگیر، و sendNavigation را از useWebSocket
  const { isConnected, sendNavigation, sendEnd } = useWebSocket();
  const {
    managerLastLeaderboard,
    leaderboardResults,
    modalLeaderboardResults,
  } = useServerData();

  // حذف state داخلی و فقط استفاده از داده context

  // Get the question ID from the previous slide (leaderboard usually comes after a question)
  // NOTE: slide indices are 0-based, but currentSlide appears to be 1-based
  // When on a leaderboard slide, the question before it is always at currentSlide - 1
  const questionSlideIndex = currentSlide - 1;
  const questionSlide =
    questionSlideIndex >= 0 && quiz?.slides
      ? quiz.slides[questionSlideIndex]
      : null;
  const previousQuestionId = questionSlide?.question_id;

  // Try to get leaderboard for this specific question, or use current leaderboardResults
  const leaderboardForThisQuestion = previousQuestionId
    ? getLeaderboardForQuestion(previousQuestionId)
    : null;
  // همیشه آخرین لیدربرد معتبر را نگه دار و اگر داده جدید نیامد، پاک نکن
  // اگر هیچ داده‌ای برای اسلاید فعلی نبود، آخرین لیدربرد معتبر را نمایش بده
  let dataToUse = leaderboardResults || leaderboardForThisQuestion;

  // اگر داده فعلی خالی است، از آخرین داده معتبر استفاده کن
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

  // فقط داده را از context می‌گیریم و هیچ وقت setPlayers نمی‌زنیم
  const results = useMemo(
    () => dataToUse?.results || dataToUse || [],
    [dataToUse]
  );

  console.log("[ManagerLeaderBoard] Render Cycle:");
  console.log("  - leaderboardResults:", leaderboardResults);
  console.log("  - managerLastLeaderboard:", managerLastLeaderboard);
  console.log("  - dataToUse:", dataToUse);
  console.log("  - derived results:", results);

  // همیشه از rank سرور استفاده کن و هیچوقت index را جایگزین نکن
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
            new_points: user.new_points || 0,
          }))
        : [],
    [results]
  );

  console.log("[ManagerLeaderBoard DEBUG] players:", players);

  // Calculate current question number and details from currentSlide
  const currentQuestionIndex = currentSlide - 1;
  const [hovered, setHovered] = useState(null);
  const [hiddenNames, setHiddenNames] = useState([]);
  const [displayedPlayers, setDisplayedPlayers] = useState([]);
  const [animateBars, setAnimateBars] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [_navigationData, setNavigationData] = useState(
    createNextPrevious(5, null, null)
  );

  // هیچ پیام مستقیمی از سرور پردازش نمی‌شود، فقط داده context استفاده می‌شود

  // Handle navigation and update server data
  const handleNext = () => {
    const newNavigationData = createNextPrevious(
      5,
      "next",
      currentQuestionIndex
    );
    setNavigationData(newNavigationData);
    console.log(
      "[LeaderBoard] Navigation data to send to server:",
      newNavigationData
    );

    // Send navigation to WebSocket
    sendNavigation("next");

    if (onNext) onNext();
  };

  const handlePrevious = () => {
    const newNavigationData = createNextPrevious(
      5,
      "previous",
      currentQuestionIndex
    );
    setNavigationData(newNavigationData);
    console.log(
      "[LeaderBoard] Navigation data to send to server:",
      newNavigationData
    );

    // Send navigation to WebSocket
    sendNavigation("previous");

    if (onPrevious) onPrevious();
  };

  const handleEnd = () => {
    console.log("[LeaderBoard] Sending end command to server");
    sendEnd();
    if (onEndGame) onEndGame();
  };

  const handleToggleBlur = (id) => {
    setHiddenNames((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const maxScore = Math.max(...players.map((p) => p.total_points));
  const minScore = 0;

  const calcPercent = (score) => {
    if (maxScore === minScore) return 100;
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

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col justify-around items-center font-semibold"
      style={backgroundStyle}
    >
      <TopBar
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
            {/* WebSocket Connection Status */}
            <div className="absolute top-20 right-4 flex items-center gap-2 text-xs z-50">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span className="text-white/80">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {/* Title and player count */}
            <div className="text-center w-full">
              <h2 className="text-6xl text-white font-bold mb-4">
                Leaderboard
              </h2>
              <p className="text-white/70 text-lg mt-2">
                {players.length} players
              </p>
            </div>

            {/* Scrollable players list — only this area will scroll when long */}
            <div className="mt-6 flex-1 w-full max-w-4xl">
              {/* Scrollable players list — only this area will scroll when long */}
              <div
                className="mt-2 flex-1 overflow-auto w-full min-h-0 no-scrollbar"
                style={{ maxHeight: "calc(100vh - 260px)" }}
              >
                {players.length === 0 ? (
                  <div className="text-white/80 text-center py-6">
                    Waiting for leaderboard data…
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
                                    className={`text-white font-medium transition-all duration-200 ${
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
                                        👁️
                                      </button>
                                      {/* <button
                                        onClick={() =>
                                          handleClick("✏️ Edit", p.name)
                                        }
                                        className="bg-white/90 text-blue-600 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleClick("📞 Call", p.name)
                                        }
                                        className="bg-white/90 text-green-600 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                      >
                                        📞
                                      </button> */}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Score */}
                            <div className="relative w-[10%] text-white font-semibold ml-3">
                              {Math.round(p.total_points)}p{" "}
                              <span className="text-white/60 text-sm">
                                +{Math.round(p.new_points)}
                              </span>
                            </div>
                          </Motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
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
          stats={DefaultFooterStats}
          showQRButton={true}
          onQRToggle={setShowQRModal}
          isQROpen={showQRModal}
          onShowLeaderboard={() => setShowLeaderboardModal(true)}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onEnd={handleEnd}
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
                  <span className="text-4xl">🏆</span>
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
                  ×
                </button>
              </div>

              <div className="space-y-3">
                {(() => {
                  const modalPlayers = modalLeaderboardResults || [];
                  console.log("[LeaderBoard] Modal players:", modalPlayers);
                  const maxScore = Math.max(
                    ...modalPlayers.map((p) => p.total_points || 0),
                    0
                  );
                  console.log("[LeaderBoard] Max score:", maxScore);

                  // درصد امتیاز نسبت به نفر اول
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
  );
}

export default ManagerLeaderBoard;
