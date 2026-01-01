import React, { useState, useEffect } from "react";
import TopBar from "../../../components/TopBar";
import QRSidebar from "../../../components/QRSidebar";
import Footer from "../../../components/Footer";
// LeaderboardModal was removed; modal UI now lives on Manager LeaderBoard page
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useServerData } from "../../../hooks/useServerData";
import {
  User_adding,
  QuizSetup,
  createNextPrevious,
  UserColorList,
  DefaultFooterStats,
} from "../../../data/mockData";

// Calculate players ready based on the User_adding.type
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
  currentSlide = 1,
  totalSlides = 3,
  quiz,
  onEndGame,
}) {
  const { isConnected, connect, sendNavigation, sendEnd, lastMessage } =
    useWebSocket();
  const { users, processMessage } = useServerData();

  const [page, setPage] = useState("lobby"); // 'lobby' | 'quiz'
  const [newUserId, setNewUserId] = useState(null);
  const [previousUserCount, setPreviousUserCount] = useState(
    User_adding.Users.length
  );
  const [layoutType, setLayoutType] = useState("circle"); // 'circle', 'diagonalCircle', 'triangle', 'scatter'
  const [centerOffset, setCenterOffset] = useState({ x: 0, y: 0 });
  const [hiddenUsers, setHiddenUsers] = useState(new Set()); // Track which users have been clicked
  const [showQRModal, setShowQRModal] = useState(false); // State for QR modal
  const [_navigationData, setNavigationData] = useState(
    createNextPrevious(5, null, null)
  ); // State for tracking navigation (to be sent to server)
  const [_userCount, setUserCount] = useState(User_adding.Users.length); // Track user count for reactivity
  const [sessionId] = useState(roomId); // Session ID from route

  // استفاده از بازیکنان از سرور یا mock data
  const displayUsers = users.length > 0 ? users : User_adding.Users;
  const playersReady = users.length || calculatePlayersReady(User_adding);

  // Calculate current question number and details from currentSlide
  const currentQuestionIndex = Math.floor(currentSlide / 2);
  const questionNumber = currentQuestionIndex + 1;
  const totalQuestions = QuizSetup.slides.length;

  // List of 10 vibrant colors for user names
  const colorList = UserColorList;

  // Function to get color for a user based on their user_id
  const getUserColor = (userId) => {
    // Use user_id to deterministically assign a color
    const colorIndex = userId % colorList.length;
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
    connect(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle incoming WebSocket messages and save to ServerData
  useEffect(() => {
    if (!lastMessage) return;

    console.log("[JoinPage] Received message:", lastMessage);

    // ذخیره پیام در ServerData
    processMessage(lastMessage);
  }, [lastMessage, processMessage]);

  // Handle navigation and update server data
  const handleNext = () => {
    const newNavigationData = createNextPrevious(
      5,
      "next",
      currentQuestionIndex
    );
    setNavigationData(newNavigationData);
    console.log(
      "[JoinPage2] Navigation data to send to server:",
      newNavigationData
    );

    // Send navigation to WebSocket
    sendNavigation("next");

    if (onNext) onNext();
  };

  const handleEnd = () => {
    console.log("[JoinPage] Sending end command to server");
    sendEnd();
    if (onEndGame) onEndGame();
  };

  const handleStart = () => {
    const newNavigationData = createNextPrevious(
      5,
      "start",
      currentQuestionIndex
    );
    setNavigationData(newNavigationData);
    setPage("quiz");
    console.log(
      "[JoinPage2] Starting quiz, navigation data to send to server:",
      newNavigationData
    );

    // Send start command
    sendNavigation("next");

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
    setUserCount(currentUserCount);

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
  const backgroundStyle = {
    backgroundImage: quiz?.background?.image
      ? `url('${quiz.background.image}')`
      : "none",
    backgroundColor: quiz?.background?.color || "#1e1e2e",
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat "
      style={backgroundStyle}
    >
      <div
        className={`w-full pt-16! sm:pt-36 md:pt-40 pb-24 px-4 sm:px-3 flex ${
          showQRModal ? "justify-end" : "justify-center"
        } transition-all duration-300`}
      >
        {/* Top bar */}
        <TopBar
          accessCode={quiz?.access_code}
          showQRButton={true}
          onQRToggle={setShowQRModal}
          isQROpen={showQRModal}
        />

        {/* Main stage */}
        <main
          className={`${
            showQRModal ? "w-[78%] mr-4" : "w-[88%]"
          } max-w-[2000px] bg-gray-800 rounded-2xl lg:rounded-2xl md:rounded-xl sm:rounded-xl pt-4! pb-20! md:pt-8 md:pb-12 lg:pb-18 px-4 sm:px-4 md:px-16 lg:px-72! text-white shadow-2xl relative transition-all duration-300`}
        >
          {/* WebSocket Connection Status */}
          <div className="absolute top-2 right-2 flex items-center gap-2 text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            ></div>
            <span className="text-white/60">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <div className="text-xl md:text-2xl lg:text-3xl font-semibold">
              {page === "lobby"
                ? `Quiz question ${questionNumber} of ${totalQuestions}`
                : "Quiz"}
            </div>
            <div className="text-xs md:text-sm text-white/60">
              {playersReady} players ready
            </div>
          </div>

          <div className="min-h-[400px] max-h-[600px] flex items-center justify-center overflow-visible">
            {page === "lobby" ? (
              <div className="w-full">
                {displayUsers.length === 0 && (
                  <div
                    className="text-xl md:text-2xl lg:text-3xl text-white/92 text-center animate-custom-pulse"
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
                    className="inline-flex items-center gap-1.5 bg-linear-to-br from-purple-800 to-purple-600 text-white px-8! py-3! rounded-lg border-none cursor-pointer font-semibold text-base shadow-lg shadow-purple-600/40 transition-all duration-150 hover:-translate-y-1 hover:scale-110 hover:shadow-xl hover:shadow-purple-600/50 after:content-['⏵'] after:text-sm after:ml-1"
                    onClick={handleStart}
                  >
                    Start
                  </button>
                </div>
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

        {/* Footer */}

        <Footer
          currentSlide={currentSlide}
          totalSlides={totalSlides}
          stats={{
            ...DefaultFooterStats,
            players: { current: playersReady, max: 50 },
          }}
          showQRButton={true}
          onQRToggle={setShowQRModal}
          isQROpen={showQRModal}
          onNext={handleNext}
          onEnd={handleEnd}
          // onPrevious=null
        />

        {/* QR Code Sidebar */}
        <QRSidebar
          accessCode={quiz?.access_code}
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
        />

        {/* Leaderboard modal removed - manager LeaderBoard page now contains modal UI */}
      </div>
    </div>
  );
}
