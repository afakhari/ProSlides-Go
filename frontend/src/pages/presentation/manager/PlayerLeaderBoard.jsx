import React, { useState, useEffect } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import TopBar from "../../../components/TopBar";
import QRSidebar from "../../../components/QRSidebar";
import Footer from "../../../components/Footer";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { DefaultFooterStats } from "../../../data/mockData";

function ManagerPlayerLeaderBoard({
  onNext,
  onPrevious,
  currentSlide = 1,
  totalSlides = 3,
  roomId,
  quiz = null,
  players = [],
}) {
  const [hovered, setHovered] = useState(null);
  const [hiddenNames, setHiddenNames] = useState([]);
  const [displayedPlayers, setDisplayedPlayers] = useState([]);
  const [animateBars, setAnimateBars] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const { isConnected } = useWebSocket();

  console.log(
    "[ManagerPlayerLeaderBoard] Rendering with",
    players?.length || 0,
    "players"
  );

  const handleToggleBlur = (id) => {
    setHiddenNames((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClick = (action, name) => {
    alert(`${action} clicked for ${name}`);
  };

  const maxScore = Math.max(...players.map((p) => p.total_points));
  const minScore = 0;

  const calcPercent = (score) => {
    if (maxScore === minScore) return 100;
    const percent = ((score - minScore) / (maxScore - minScore)) * 99 + 1;
    return percent;
  };

  useEffect(() => {
    // Ensure players have colors and are displayed as received from server
    const processedPlayers = players.map((p) => ({
      ...p,
      color: p.color || "#6366f1", // Default color if missing
    }));
    setDisplayedPlayers(processedPlayers);

    // Trigger animation
    setAnimateBars(false);
    const t = setTimeout(() => {
      setAnimateBars(true);
    }, 500);

    return () => clearTimeout(t);
  }, [players]);

  const accessCode = quiz?.access_code || roomId;

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
        accessCode={accessCode}
        showQRButton={true}
        onQRToggle={setShowQRModal}
        isQROpen={showQRModal}
      />

      <QRSidebar
        accessCode={accessCode}
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
              <h1 className="text-white px-4 text-5xl font-bold">
                Leaderboard
              </h1>
              <p className="text-white/70 text-lg mt-2">
                {players.length} players
              </p>
            </div>

            {/* Scrollable players list */}
            <div className="mt-6 flex-1 w-full max-w-4xl">
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
                        const widthPercent = calcPercent(p.total_points);

                        return (
                          <Motion.li
                            key={p.user_id || p.rank}
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
                            <div className="text-white/90 text-lg font-semibold w-8 text-center rounded-full bg-white/20 mr-3 py-1">
                              {p.rank}
                            </div>

                            {/* Fixed-width translucent track */}
                            <div className="relative overlay-hidden bg-white/10 w-full h-14 mr-3">
                              {/* Colored fill */}
                              <Motion.div
                                className={`absolute left-0 top-0 h-full z-10`}
                                style={{ backgroundColor: p.color }}
                                initial={{ width: 0 }}
                                animate={{
                                  width: animateBars ? `${widthPercent}%` : 0,
                                }}
                                transition={{
                                  duration: 1.3,
                                  ease: "easeOut",
                                }}
                              />

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
                                      <button
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
                                      </button>
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
        </main>

        <Footer
          currentSlide={currentSlide}
          totalSlides={totalSlides}
          stats={DefaultFooterStats}
          showQRButton={true}
          onQRToggle={setShowQRModal}
          isQROpen={showQRModal}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      </div>
    </div>
  );
}

export default ManagerPlayerLeaderBoard;
