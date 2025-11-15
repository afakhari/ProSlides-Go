import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";

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

function PlayerLeaderBoard({ players }) {
  const [hovered, setHovered] = useState(null);
  const [hiddenNames, setHiddenNames] = useState([]);
  const [displayedPlayers, setDisplayedPlayers] = useState([]);
  const [animateBars, setAnimateBars] = useState(false);
  // const navigate = useNavigate();

  const handleToggleBlur = (id) => {
    setHiddenNames((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClick = (action, name) => {
    alert(`${action} clicked for ${name}`);
  };

  const maxScore = Math.max(...players.map((p) => p.total_points));
  const minScore = Math.min(...players.map((p) => p.total_points));

  const calcPercent = (score) => {
    if (maxScore === minScore) return 100;
    const percent = ((score - minScore) / (maxScore - minScore)) * 99 + 1;
    return Math.max(percent, 1);
  };

  useEffect(() => {
    const withOld = players.map((p) => ({
      ...p,
      oldScore: p.total_points - p.new_points,
    }));
    const sortedOld = [...withOld].sort((a, b) => b.oldScore - a.oldScore);
    setDisplayedPlayers(sortedOld);

    const t = setTimeout(() => {
      const sortedNew = [...players].sort(
        (a, b) => b.total_points - a.total_points
      );
      setDisplayedPlayers(sortedNew);
      setAnimateBars(true);
    }, 1200);

    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="h-screen overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/src/assets/bg.jpg')" }}
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
                  const widthPercent = calcPercent(p.total_points);

                  return (
                    <motion.li
                      key={p.rank}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{
                        type: "spring",
                        stiffness: 120,
                        damping: 18,
                      }}
                      className="flex justify-start items-center relative w-[90%] max-w-2xl mx-auto"
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
                        <motion.div
                          className={`absolute left-0 top-0 h-full z-10`}
                          style={{ backgroundColor: p.color }}
                          initial={{ width: 0 }}
                          animate={{
                            width: animateBars ? `${widthPercent}%` : 0,
                          }}
                          transition={{ duration: 1.3, ease: "easeOut" }}
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
                      <div className="relative w-[15%] text-white font-semibold ml-3">
                        {Math.round(p.total_points)}p{" "}
                        <span className="text-white/60 text-sm">
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
