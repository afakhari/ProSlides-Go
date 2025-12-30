import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { getColorForUser } from "../../../lib/colorUtils";

// const players = [
//   {
//     user_id: 1,
//     name: "Chloe",
//     character: "👑",
//     color: "#db2777",
//     rank: 1,
//     total_points: 153,
//     new_points: 61,
//   },
//   {
//     user_id: 2,
//     name: "Trang",
//     character: "🌸",
//     color: "#059669",
//     rank: 2,
//     total_points: 149,
//     new_points: 49,
//   },
//   {
//     user_id: 3,
//     name: "Alex",
//     character: "🐱",
//     color: "#65a30d",
//     rank: 3,
//     total_points: 34,
//     new_points: 34,
//   },
//   {
//     user_id: 4,
//     name: "Jenny",
//     character: "🧁",
//     color: "#2563eb",
//     rank: 5,
//     total_points: 0,
//     new_points: 0,
//   },
//   {
//     user_id: 5,
//     name: "Kian",
//     character: "😂",
//     color: "#4563bb",
//     rank: 4,
//     total_points: 20,
//     new_points: 20,
//   },
// ];

function PlayerLeaderBoard({ players, quiz }) {
  const [hovered, setHovered] = useState(null);
  const [hiddenNames, setHiddenNames] = useState([]);
  const [displayedPlayers, setDisplayedPlayers] = useState([]);
  const [animateBars, setAnimateBars] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  // const navigate = useNavigate();

  console.log(
    "[PlayerLeaderBoard] Rendering with",
    players?.length || 0,
    "players"
  );

  // خواندن user_id بازیکن فعلی از localStorage
  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    setCurrentUserId(userId);
  }, []);

  const handleToggleBlur = (id) => {
    setHiddenNames((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClick = (action, name) => {
    alert(`${action} clicked for ${name}`);
  };

  const maxScore = Math.max(
    ...players.map((p) => parseFloat(p.total_points) || 0)
  );
  const minScore = 0;

  const calcPercent = (score) => {
    const val = parseFloat(score) || 0;
    if (maxScore <= minScore) return 100;
    // Calculate percentage relative to max score
    const percent = (val / maxScore) * 100;
    return Math.max(percent, 1);
  };

  useEffect(() => {
    // Ensure players have colors based on user_id
    const processedPlayers = players.map((p) => ({
      ...p,
      color: getColorForUser(p.user_id),
    }));
    setDisplayedPlayers(processedPlayers);

    // Trigger animation only if not already animated
    if (!animateBars) {
      const t = setTimeout(() => {
        setAnimateBars(true);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [players, currentUserId, animateBars]);

  // Calculate dynamic background style from quiz data
  const backgroundStyle = {
    backgroundImage: quiz?.background?.image
      ? `url('${quiz.background.image}')`
      : "url('/bg.jpg')",
    backgroundColor: quiz?.background?.color || "#1e1e2e",
  };

  return (
    <div
      className="h-screen overflow-hidden bg-cover bg-center bg-no-repeat"
      style={backgroundStyle}
    >
      <header>
        <div className="flex items-center justify-center text-white px-6 py-7 rounded-t-xl placeholder-gray-500">
          <div className="shrink-0">
            <p className="text-3xl">Proslides</p>
          </div>
        </div>
      </header>

      <div className="mt-7 flex-1 flex flex-col min-h-0">
        <section className="flex-1 flex flex-col min-h-0">
          {/* Title and player count */}
          <div className="text-center">
            <h1 className="text-white px-4 text-5xl font-bold">Leaderboard</h1>
            <p className="text-white/70 text-lg mt-2">
              {players.length} players
            </p>
          </div>

          {/* Scrollable players list */}
          <div
            className="mt-6 flex-1 overflow-auto w-full min-h-0 no-scrollbar"
            style={{ maxHeight: "calc(100vh - 220px)" }}
          >
            <ul className="space-y-4 w-full flex flex-col items-stretch py-2">
              <AnimatePresence>
                {displayedPlayers.map((p) => {
                  const isHidden = hiddenNames.includes(p.rank);
                  const scoreVal = parseFloat(p.total_points) || 0;
                  const hasScore = scoreVal > 0;
                  const widthPercent = hasScore ? calcPercent(scoreVal) : 0;
                  const isCurrentUser = p.user_id === currentUserId;

                  return (
                    <motion.li
                      key={p.user_id || p.rank}
                      id={`player-${p.user_id}`}
                      layout
                      initial={{
                        opacity: 0,
                        x: -20,
                        scale: isCurrentUser ? 0.9 : 1,
                      }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        scale: isCurrentUser ? 1.08 : 1,
                      }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{
                        type: "spring",
                        stiffness: 120,
                        damping: 18,
                      }}
                      className={`flex justify-start items-center relative w-[90%] max-w-2xl mx-auto rounded-xl ${
                        isCurrentUser ? "z-20 my-2" : "z-10"
                      }`}
                      style={
                        isCurrentUser
                          ? {
                              background: `linear-gradient(135deg, ${p.color}40, ${p.color}20)`,
                              boxShadow: `0 0 30px ${p.color}80, 0 0 60px ${p.color}50, inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                              border: `2px solid ${p.color}cc`,
                              padding: "8px",
                            }
                          : {}
                      }
                      onMouseEnter={() => setHovered(p.rank)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* Glow effect for current user */}
                      {isCurrentUser && (
                        <motion.div
                          className="absolute inset-0 rounded-xl pointer-events-none"
                          animate={{
                            boxShadow: [
                              `0 0 20px ${p.color}60`,
                              `0 0 40px ${p.color}90`,
                              `0 0 20px ${p.color}60`,
                            ],
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      )}

                      {/* Rank */}
                      <div
                        className={`text-lg font-bold w-10 h-10 flex items-center justify-center rounded-full mr-3`}
                        style={{
                          backgroundColor: p.color,
                          color: "#fff",
                          boxShadow: `0 4px 12px ${p.color}60`,
                        }}
                      >
                        {p.rank}
                      </div>

                      {/* Fixed-width translucent track */}
                      <div
                        className={`relative overflow-hidden w-full mr-3 rounded-lg ${
                          isCurrentUser
                            ? "bg-white/20 h-16"
                            : "bg-white/10 h-14"
                        }`}
                      >
                        {/* Colored fill - only show if score > 0 */}
                        {hasScore && (
                          <motion.div
                            className={`absolute left-0 top-0 h-full z-10 rounded-lg`}
                            style={{
                              backgroundColor: p.color,
                              boxShadow: `0 4px 15px ${p.color}80, 0 2px 8px ${p.color}60`,
                            }}
                            initial={{ width: 0 }}
                            animate={{
                              width: animateBars ? `${widthPercent}%` : 0,
                            }}
                            transition={{ duration: 1.3, ease: "easeOut" }}
                          />
                        )}

                        {/* Content on top */}
                        <div
                          className={`relative z-20 flex items-center px-4 gap-4 h-full`}
                        >
                          <div
                            className={`player-avatar ${
                              isCurrentUser ? "text-3xl" : "text-2xl"
                            }`}
                          >
                            {p.character}
                          </div>

                          <div className="flex items-center space-x-3">
                            <div
                              className={`font-medium transition-all duration-200 ${
                                isCurrentUser
                                  ? "text-white text-lg font-bold"
                                  : "text-white"
                              } ${isHidden ? "blur-sm select-none" : ""}`}
                            >
                              {isHidden ? "****" : p.name}
                              {isCurrentUser && (
                                <span className="ml-2 text-yellow-400 text-sm animate-pulse">
                                  ← You
                                </span>
                              )}
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
                                  onClick={() => handleClick("✏️ Edit", p.name)}
                                  className="bg-white/90 text-blue-600 px-2 py-1 rounded-lg text-sm hover:bg-white"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleClick("📞 Call", p.name)}
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
                      <div className="relative w-[15%] font-semibold ml-3 text-white">
                        {Math.round(p.total_points)}p{" "}
                        <span className="text-sm text-white/60">
                          +{Math.round(p.new_points)}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

export default PlayerLeaderBoard;
