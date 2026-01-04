import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getColorForUser } from "../../../lib/colorUtils";

const MotionH1 = motion.h1;
const MotionButton = motion.button;
const MotionDiv = motion.div;

export default function FinalLeaderboard({ leaderboardData, onExit }) {
  const [visiblePlayers, setVisiblePlayers] = useState([]);

  // Sort players by rank/points just in case, though server usually sends sorted
  const players = useMemo(
    () =>
      (leaderboardData?.results || leaderboardData || [])
        .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
        .slice(0, 3),
    [leaderboardData]
  );

  // Reverse for reveal order: 3rd, then 2nd, then 1st
  const revealOrder = useMemo(() => [...players].reverse(), [players]);

  useEffect(() => {
    // Sequence the reveal
    const timers = revealOrder.map((player, index) => {
      return setTimeout(() => {
        setVisiblePlayers((prev) => {
          // Avoid duplicates
          if (prev.find((p) => p.user_id === player.user_id)) return prev;
          return [...prev, player];
        });
      }, (index + 1) * 2000); // 2 seconds delay between each
    });

    return () => timers.forEach(clearTimeout);
  }, [revealOrder]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[url('/bg.jpg')] bg-cover bg-center opacity-50" />

      <MotionH1
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="text-6xl font-bold text-white mb-16 z-10 relative drop-shadow-lg"
      >
        Final Results
      </MotionH1>

      <div className="flex items-end justify-center gap-4 md:gap-12 z-10 h-[400px] px-4">
        {/* We render slots for 2nd, 1st, 3rd to make the podium shape */}
        {/* But we need to render them only if they are in visiblePlayers */}

        {/* 2nd Place (Left) */}
        {players[1] && (
          <PlayerPodium
            player={players[1]}
            rank={2}
            isVisible={visiblePlayers.some(
              (p) => p.user_id === players[1].user_id
            )}
            delay={0}
          />
        )}

        {/* 1st Place (Center) */}
        {players[0] && (
          <PlayerPodium
            player={players[0]}
            rank={1}
            isVisible={visiblePlayers.some(
              (p) => p.user_id === players[0].user_id
            )}
            delay={0}
          />
        )}

        {/* 3rd Place (Right) */}
        {players[2] && (
          <PlayerPodium
            player={players[2]}
            rank={3}
            isVisible={visiblePlayers.some(
              (p) => p.user_id === players[2].user_id
            )}
            delay={0}
          />
        )}
      </div>

      <MotionButton
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 8 }}
        onClick={onExit}
        className="mt-16 z-10 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-sm transition-all border border-white/20"
      >
        Close Presentation
      </MotionButton>
    </div>
  );
}

function PlayerPodium({ player, rank, isVisible }) {
  const styles = {
    1: {
      height: "h-64",
      color: "bg-yellow-500",
      border: "border-yellow-300",
      text: "text-yellow-300",
      icon: "👑",
    },
    2: {
      height: "h-48",
      color: "bg-slate-400",
      border: "border-slate-300",
      text: "text-slate-300",
      icon: "🥈",
    },
    3: {
      height: "h-32",
      color: "bg-amber-600",
      border: "border-amber-400",
      text: "text-amber-400",
      icon: "🥉",
    },
  };

  const style = styles[rank];
  const userColor = getColorForUser(player.user_id);

  return (
    <div className="flex flex-col items-center justify-end w-32 md:w-48">
      <AnimatePresence>
        {isVisible && (
          <MotionDiv
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5, duration: 1 }}
            className="flex flex-col items-center w-full"
          >
            {/* Avatar/Character */}
            <MotionDiv
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="mb-4 relative"
            >
              <div
                className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-4xl border-4 shadow-lg bg-gray-800"
                style={{ borderColor: userColor }}
              >
                {player.character || "👤"}
              </div>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl">
                {style.icon}
              </div>
            </MotionDiv>

            {/* Name & Score */}
            <div className="text-center mb-2">
              <h3 className="text-white font-bold text-xl md:text-2xl truncate max-w-[150px] drop-shadow-md">
                {player.name}
              </h3>
              <p className={`font-mono font-bold ${style.text}`}>
                {Math.round(player.total_points)} pts
              </p>
            </div>

            {/* Podium Bar */}
            <div
              className={`w-full ${style.height} ${style.color} rounded-t-lg shadow-2xl border-t-4 ${style.border} flex items-end justify-center pb-4 bg-opacity-90 backdrop-blur-sm`}
            >
              <span className="text-4xl font-black text-black/30">{rank}</span>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

