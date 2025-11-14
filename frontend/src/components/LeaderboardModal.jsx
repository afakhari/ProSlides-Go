import React from "react";
import { DefaultModalPlayers } from "../data/mockData";

export default function LeaderboardModal({ isOpen, onClose, players = [] }) {
  if (!isOpen) return null;

  // Sample players if none provided
  const defaultPlayers = DefaultModalPlayers;

  const displayPlayers = players.length > 0 ? players : defaultPlayers;
  const sortedPlayers = [...displayPlayers].sort((a, b) => b.points - a.points);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-gray-900 rounded-xl p-8 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🏆</span>
              <div>
                <h2 className="text-white text-3xl font-bold">Leaderboard</h2>
                <p className="text-gray-400 text-sm">
                  {sortedPlayers.length} players
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 text-3xl border-none bg-transparent cursor-pointer leading-none"
            >
              ×
            </button>
          </div>

          {/* Leaderboard List */}
          <div className="space-y-3">
            {sortedPlayers.map((player, index) => {
              const maxPoints = sortedPlayers[0]?.points || 1;
              const barWidth = (player.points / maxPoints) * 100;

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-4 relative"
                >
                  {/* Rank */}
                  <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                    {index + 1}
                  </div>

                  {/* Player Bar */}
                  <div className="flex-1 relative">
                    <div
                      className="rounded-lg h-16 transition-all duration-1000 flex items-center px-4 gap-3"
                      style={{
                        backgroundColor: player.color,
                        width: `${Math.max(barWidth, 15)}%`,
                      }}
                    >
                      <span className="text-2xl">{player.character}</span>
                      <span className="text-white font-semibold text-lg">
                        {player.name}
                      </span>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-white font-bold text-xl shrink-0 w-20 text-right">
                    {player.points}p
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show More Button */}
          {sortedPlayers.length > 5 && (
            <button className="w-full mt-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border-none cursor-pointer transition-colors flex items-center justify-center gap-2">
              <span>▼</span>
              <span>Show more</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
