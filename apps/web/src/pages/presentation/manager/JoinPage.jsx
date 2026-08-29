import React, { useState, useEffect } from "react";
import TopBar from "../../../components/TopBar";
import QRSidebar from "../../../components/QRSidebar";
// LeaderboardModal was removed; modal UI now lives on Manager LeaderBoard page
import { useLiveSession } from "../../../hooks/useLiveSession";
import { useServerData } from "../../../hooks/useServerData";
import { participantTheme } from "../../../modules/live/participant/theme";
import {
  EMPTY_ROSTER,
  USER_COLORS,
} from "../../../modules/live/model/runtimeDefaults";

const hashToColorIndex = (value, modulo) => {
  const str = String(value ?? "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
};

// Calculate the ready count from the bounded roster projection.
function calculatePlayersReady({ type, Users }) {
  // Extendable rule-set; for now, type 1 => count all users
  switch (type) {
    case 1:
    default:
      return Users?.length ?? 0;
  }
}

export default function ManagerJoinPage({
  roomId,
  onNext,
  quiz,
}) {
  const {
    isConnected,
    connectionError,
    connect,
    sendNavigation,
    snapshot,
    participantCount,
    hasMoreRoster,
    isRosterLoading,
    loadMoreRoster,
  } = useLiveSession();
  const {
    users,
    currentQuestion,
    currentContent,
    leaderboardResults,
  } = useServerData();

  const [page, setPage] = useState("lobby"); // 'lobby' | 'quiz'
  const [startError, setStartError] = useState("");
  const [newUserId, setNewUserId] = useState(null);
  const [previousUserCount, setPreviousUserCount] = useState(
    EMPTY_ROSTER.Users.length
  );
  const [layoutType, setLayoutType] = useState("circle"); // 'circle', 'diagonalCircle', 'triangle', 'scatter'
  const [centerOffset, setCenterOffset] = useState({ x: 0, y: 0 });
  const [hiddenUsers, setHiddenUsers] = useState(new Set()); // Track which users have been clicked
  const [showQRModal, setShowQRModal] = useState(false); // State for QR modal
  const [hasSyncedState, setHasSyncedState] = useState(false);
  const [sessionId] = useState(roomId); // Session ID from route

  // استفاده از بازیکنان از سرور یا mock data
  const displayUsers = snapshot ? users : EMPTY_ROSTER.Users;
  const playersReady = snapshot
    ? participantCount
    : users.length || calculatePlayersReady(EMPTY_ROSTER);
  const hasLeaderboard =
    Array.isArray(leaderboardResults) ?
      leaderboardResults.length > 0 :
      Array.isArray(leaderboardResults?.results) &&
      leaderboardResults.results.length > 0;
  const sessionInProgress =
    !!currentQuestion ||
    !!currentContent ||
    hasLeaderboard;

  useEffect(() => {
    if (!hasSyncedState && snapshot) {
      setHasSyncedState(true);
    }
  }, [snapshot, hasSyncedState]);

  useEffect(() => {
    if (hasSyncedState) return;
    if (isConnected) return;
    const timer = setTimeout(() => {
      setHasSyncedState(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [hasSyncedState, isConnected]);

  // List of 10 vibrant colors for user names
  const colorList = USER_COLORS;

  // Function to get color for a user based on their user_id
  const getUserColor = (userId) => {
    // Use stable hashing so both numeric and string IDs get deterministic colors.
    const colorIndex = hashToColorIndex(userId, colorList.length);
    return colorList[colorIndex];
  };

  // Function to handle user name click
  const handleUserClick = (userId) => {
    setHiddenUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId); // Toggle: if already hidden, show it again
      } else {
        newSet.add(userId); // Hide the name
      }
      return newSet;
    });
  };

  // Function to format user display name
  const formatUserName = (user) => {
    if (hiddenUsers.has(user.user_id)) {
      // Show character + *****
      return user.character + "*****";
    }
    return user.character + user.name;
  };

  // Auto-connect on mount
  useEffect(() => {
    if (!sessionId) return;
    if (isConnected) return;
    void connect(sessionId);
  }, [sessionId, isConnected, connect]);

  const handleStart = async () => {
    setStartError("");
    if (!quiz?.slides?.length) {
      setStartError("This presentation has no slides to start.");
      return;
    }
    const invalidQuestion = quiz.slides.find((slide) => {
      if (slide.slide_type !== 1) return false;
      const options = Array.isArray(slide.options) ? slide.options : [];
      const correct = options.filter((option) => option.answer === true).length;
      return !String(slide.question_text || "").trim() || options.length < 2 || correct < 1 ||
        (slide.question_type === "single" && correct !== 1);
    });
    if (invalidQuestion) {
      setStartError("Complete every question with at least two options and a valid correct answer before presenting.");
      return;
    }
    if (sessionInProgress) {
      setStartError("Session is already in progress. Resuming current slide...");
      onNext?.();
      return;
    }
    if (!hasSyncedState) {
      setStartError("Syncing live session state. Please wait a moment.");
      return;
    }
    if (!isConnected) {
      setStartError("Connection is not ready. Please wait and try again.");
      return;
    }
    // Send start command
    const ok = await sendNavigation("start", { slide: quiz?.slides?.[0] });
    if (!ok) {
      setStartError("Failed to send start command. Please try again.");
      return;
    }

    setPage("quiz");

    if (onNext) onNext();
  };

  // Calculate position based on layout type
  const getPosition = (index, total, type, offset) => {
    let baseX = 0,
      baseY = 0;

    if (type === "circle") {
      // Arrange in a circle
      const radius = Math.min(200, 100 + total * 5);
      const angle = (index * 2 * Math.PI) / total;
      baseX = Math.cos(angle) * radius;
      baseY = Math.sin(angle) * radius;
    } else if (type === "diagonalCircle") {
      // Arrange in a diagonal circle (ellipse rotated)
      const radiusX = Math.min(250, 150 + total * 3);
      const radiusY = Math.min(150, 80 + total * 2);
      const angle = (index * 2 * Math.PI) / total;
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusY;
      // Rotate 45 degrees
      const rotAngle = Math.PI / 4;
      baseX = x * Math.cos(rotAngle) - y * Math.sin(rotAngle);
      baseY = x * Math.sin(rotAngle) + y * Math.cos(rotAngle);
    } else if (type === "scatter") {
      // Scatter randomly across the entire main section
      // Use golden ratio for better distribution
      const seed = index * 2654435761;

      // Calculate grid dimensions based on total players
      const cols = Math.ceil(Math.sqrt(total * 1.5)); // More columns than rows
      const rows = Math.ceil(total / cols);

      // Grid position
      const col = index % cols;
      const row = Math.floor(index / cols);

      // Spread across full width (from -500 to +500) and height (from -180 to +180)
      const totalWidth = 1000;
      const totalHeight = 360;

      const cellWidth = totalWidth / cols;
      const cellHeight = totalHeight / rows;

      // Random offset within cell using seed
      const pseudoRandomX = ((seed % 1000) / 1000) * 0.6 - 0.3;
      const pseudoRandomY = (((seed * 7) % 1000) / 1000) * 0.6 - 0.3;

      // Calculate position: center of cell + random offset
      baseX = (col - (cols - 1) / 2) * cellWidth + pseudoRandomX * cellWidth;
      baseY = (row - (rows - 1) / 2) * cellHeight + pseudoRandomY * cellHeight;
    }

    // For scatter layout, don't apply offset to keep players centered
    if (type === "scatter") {
      return {
        x: baseX,
        y: baseY,
      };
    }

    return {
      x: baseX + offset.x,
      y: baseY + offset.y,
    };
  };

  // Detect when a new user is added
  useEffect(() => {
    const currentUserCount = displayUsers.length;

    if (currentUserCount > previousUserCount) {
      // Get the newly added user (last in the array)
      const newUser = displayUsers[currentUserCount - 1];
      setNewUserId(newUser.user_id);

      // If more than 6 users, force scatter layout
      if (currentUserCount > 6) {
        setLayoutType("scatter");
      } else {
        // Cycle through layout types: circle -> diagonalCircle -> triangle -> scatter
        setLayoutType((prev) => {
          if (prev === "circle") return "diagonalCircle";
          if (prev === "diagonalCircle") return "scatter";

          return "circle";
        });
      }

      // Change center position to different points
      const positions = [
        { x: 0, y: 0 }, // center
        { x: -100, y: -50 }, // top-left
        { x: 100, y: 50 }, // bottom-right
        { x: -100, y: 50 }, // bottom-left
        { x: 100, y: -50 }, // top-right
        { x: 0, y: -60 }, // top-center
        { x: 0, y: 60 }, // bottom-center
      ];
      const randomPos = positions[Math.floor(Math.random() * positions.length)];
      setCenterOffset(randomPos);

      // Remove highlight after 3 seconds
      const timer = setTimeout(() => {
        setNewUserId(null);
      }, 2000);

      return () => clearTimeout(timer);
    }

    setPreviousUserCount(currentUserCount);
  }, [previousUserCount, displayUsers]);

  // Calculate dynamic background style from quiz data
  const theme = participantTheme(quiz);

  return (
    <div
      className="relative min-h-screen bg-cover bg-center bg-no-repeat"
      style={{
        ...theme.style,
        "--quiz-text": theme.foreground,
        "--quiz-text-muted": `color-mix(in srgb, ${theme.foreground} 70%, transparent)`,
      }}
    >
      {!hasSyncedState ? (
        <div className="relative z-10 flex min-h-screen w-full items-center justify-center">
          <div
            className={`rounded-2xl px-6 py-4 text-lg font-semibold ${
              "bg-[color:var(--live-surface)] text-[color:var(--quiz-text)]"
            }`}
          >
            Syncing live session...
          </div>
        </div>
      ) : (
      <div
        className={`relative z-10 w-full pt-16! sm:pt-36 md:pt-40 pb-24 px-4 sm:px-3 flex ${
          showQRModal ? "justify-end" : "justify-center"
        } transition-all duration-300`}
      >
        {/* Top bar */}
        <TopBar
          isConnected={isConnected}
          accessCode={quiz?.access_code}
          showQRButton={true}
          onQRToggle={setShowQRModal}
          isQROpen={showQRModal}
        />

        {/* Main stage */}
        <main
          className={`${
            showQRModal ? "w-[78%] mr-4" : "w-[88%]"
          } max-w-[2000px] ${
            "bg-[color:var(--live-surface)] text-[color:var(--quiz-text)] backdrop-blur-sm"
          } rounded-2xl lg:rounded-2xl md:rounded-xl sm:rounded-xl pt-4! pb-20! md:pt-8 md:pb-12 lg:pb-18 px-4 sm:px-4 md:px-16 lg:px-72! shadow-2xl relative transition-all duration-300`}
        >
          <div className="flex flex-col items-center gap-1.5">
            {/* <div className="text-xl md:text-2xl lg:text-3xl font-semibold">
              {page === "lobby"
                ? `Quiz question ${questionNumber} of ${totalQuestions}`
                : "Quiz"}
            </div> */}
            <div className="text-xs md:text-sm text-[color:var(--quiz-text-muted)]">
              {playersReady} players ready
            </div>
          </div>

          <div className="min-h-[400px] max-h-[600px] flex items-center justify-center overflow-visible">
            {page === "lobby" ? (
              <div className="w-full">
                {displayUsers.length === 0 && (
                  <div
                    className="text-xl md:text-2xl lg:text-3xl text-[color:var(--quiz-text)] text-center animate-custom-pulse"
                    style={{
                      marginTop: "190px",
                      marginBottom: "190px",
                    }}
                  >
                    <div>Waiting for players to join...</div>
                  </div>
                )}
                {displayUsers.length > 0 && (
                  <div className="relative w-full min-h-[450px] flex justify-center items-center overflow-visible">
                    {displayUsers.map((user, index) => {
                      const isNewUser = user.user_id === newUserId;
                      const position = getPosition(
                        index,
                        displayUsers.length,
                        layoutType,
                        centerOffset
                      );
                      const userColor = getUserColor(user.user_id);
                      const isHidden = hiddenUsers.has(user.user_id);

                      return (
                        <div
                          key={user.user_id}
                          className={`absolute flex flex-col items-center gap-2 min-w-[120px] transition-all duration-1000 ease-out cursor-pointer ${
                            isNewUser ? "z-10 opacity-100" : "z-1 opacity-90"
                          }`}
                          style={{
                            transform: `
                            translate(${position.x}px, ${position.y}px)
                            scale(${isNewUser ? 1.3 : 1})
                            rotate(${isNewUser ? "5deg" : "0deg"})
                          `,
                            filter: isNewUser
                              ? "brightness(1.4)"
                              : "brightness(1)",
                            animation: isNewUser
                              ? "fadeInSlide 0.6s ease-out"
                              : "none",
                          }}
                        >
                          <div
                            onClick={() => handleUserClick(user.user_id)}
                            className={`text-2xl text-center transition-all duration-500 ease-out ${
                              isNewUser
                                ? "font-bold text-green-500"
                                : "font-medium"
                            } ${
                              isHidden ? "scale-85 opacity-80" : "scale-100"
                            }`}
                            style={{
                              color: isNewUser ? "#4CAF50" : userColor,
                              textShadow: isNewUser
                                ? "0 0 20px rgba(76, 175, 80, 0.8), 0 0 10px rgba(76, 175, 80, 0.5)"
                                : `0 0 10px ${userColor}80`,
                              letterSpacing: isHidden ? "4px" : "normal",
                            }}
                          >
                            {formatUserName(user)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-center">
                  <button
                    className="inline-flex items-center gap-1.5 bg-linear-to-br from-purple-800 to-purple-600 text-white px-8! py-3! rounded-lg border-none cursor-pointer font-semibold text-base shadow-lg shadow-purple-600/40 transition-all duration-150 hover:-translate-y-1 hover:scale-110 hover:shadow-xl hover:shadow-purple-600/50 after:content-['⏵'] after:text-sm after:ml-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleStart}
                    disabled={!isConnected || sessionInProgress || !hasSyncedState}
                  >
                    {sessionInProgress
                      ? "Resuming..."
                      : !hasSyncedState
                      ? "Syncing..."
                      : "Start"}
                  </button>
                </div>
                {startError && (
                  <div className="mt-3 text-center text-sm text-red-500">
                    {startError}
                  </div>
                )}
                {connectionError && (
                  <div className="mt-3 text-center text-sm text-red-500">
                    Live session connection failed. Sign in again or retry this page.
                  </div>
                )}
                {hasMoreRoster && (
                  <div className="mt-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => void loadMoreRoster()}
                      disabled={isRosterLoading}
                      className="rounded-lg border border-white/30 px-4 py-2 text-sm text-[color:var(--quiz-text)] disabled:opacity-50"
                    >
                      {isRosterLoading ? "Loading..." : "Load more players"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl opacity-95">
                  Quiz page (coming soon)
                </div>
              </div>
            )}
          </div>
        </main>

        {/* QR Code Sidebar */}
        <QRSidebar
          accessCode={quiz?.access_code}
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
        />

        {/* Leaderboard modal removed - manager LeaderBoard page now contains modal UI */}
      </div>
      )}
    </div>
  );
}
