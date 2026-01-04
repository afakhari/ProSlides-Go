import React, { useState, useEffect, useMemo } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { getColorForUser } from "../../../lib/colorUtils";

export default function LeaderboardPreview({
  slide,
  quizBackground,
  quizBackgroundImage,
  isFullSize = true,
  customLeaderboard = null,
}) {
  const [animateBars, setAnimateBars] = useState(false);

  // Prepare players data
  const players = useMemo(() => {
    const sourceData = customLeaderboard || slide?.leaderboard;
    if (!sourceData || !Array.isArray(sourceData)) return [];

    return sourceData
      .sort((a, b) => (a.rank || 0) - (b.rank || 0))
      .slice(0, 5) // Limit to top 5 for preview
      .map((player, index) => ({
        user_id: player.rust_session_id || `player-${index}`,
        name: player.player_name || `Player ${index + 1}`,
        character: player.avatar || "🙂",
        color: getColorForUser(player.rust_session_id || index),
        rank: player.rank || index + 1,
        total_points: player.score || 0,
        new_points: 0,
      }));
  }, [slide?.leaderboard, customLeaderboard]);

  const maxScore = Math.max(...players.map((p) => p.total_points), 0);
  const minScore = 0;

  const calcPercent = (score) => {
    if (maxScore <= minScore) return 100;
    const percent = ((score - minScore) / (maxScore - minScore)) * 99 + 1;
    return Math.max(percent, 1);
  };

  useEffect(() => {
    setAnimateBars(false);
    const t = setTimeout(() => {
      setAnimateBars(true);
    }, 500);
    return () => clearTimeout(t);
  }, [players]);

  const dynamicStyle = {
    backgroundColor: quizBackground || "#1e1e2e",
    backgroundImage: quizBackgroundImage
      ? `url(${quizBackgroundImage})`
      : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  const containerClasses = isFullSize
    ? "aspect-[3/2] w-full max-w-[80%] h-auto max-h-[80%] rounded-xl shadow-lg overflow-hidden"
    : "aspect-[3/2] w-full max-w-[95%] h-auto max-h-[95%] rounded-xl shadow-md overflow-hidden";

  const titleSize = isFullSize ? "text-4xl" : "text-2xl";
  const subtitleSize = isFullSize ? "text-lg" : "text-sm";
  const rowHeight = isFullSize ? "h-14" : "h-10";
  const avatarSize = isFullSize ? "text-2xl" : "text-lg";
  const rankSize = isFullSize ? "w-10 h-10 text-lg" : "w-8 h-8 text-base";
  const nameSize = isFullSize ? "text-base" : "text-sm";
  const scoreSize = isFullSize ? "text-base" : "text-sm";
  const scoreWidth = isFullSize ? "w-16" : "w-12";

  return (
    <div
      className={`flex flex-col items-center font-sans ${containerClasses}`}
      style={dynamicStyle}
    >
      <div className="flex flex-col items-center justify-center w-full h-full px-4 py-6 overflow-y-auto no-scrollbar">
        {/* Title Section */}
        <div className="text-center w-full mb-6">
          <h2 className={`${titleSize} text-white font-bold mb-2`}>
            {slide?.leaderboard_title || "Leaderboard"}
          </h2>
          <p className={`text-white/70 ${subtitleSize}`}>
            {players.length} {players.length === 1 ? "player" : "players"}
          </p>
        </div>

        {/* Players List */}
        <div className="w-full max-w-3xl flex-1">
          {players.length === 0 ? (
            <div className="text-white/80 text-center py-6">No results yet</div>
          ) : (
            <ul className="space-y-4 w-full flex flex-col items-stretch py-2">
              <AnimatePresence>
                {players.map((p) => {
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
                      className="flex justify-start items-center relative w-full mx-auto"
                    >
                      {/* Rank */}
                      <div
                        className={`${rankSize} font-bold flex items-center justify-center rounded-full mr-3 shrink-0`}
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
                        className={`relative overlay-hidden bg-white/10 w-full ${rowHeight} mr-3 rounded-lg flex-1`}
                      >
                        {/* Colored fill */}
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
                        <div className="relative z-20 flex items-center px-4 gap-4 h-full">
                          <div className={`${avatarSize} shrink-0`}>
                            {p.character}
                          </div>
                          <div
                            className={`font-medium text-white truncate ${nameSize}`}
                          >
                            {p.name}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div
                        className={`${scoreWidth} font-semibold text-white text-right shrink-0 ${scoreSize}`}
                      >
                        {Math.round(p.total_points)}
                      </div>
                    </Motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
