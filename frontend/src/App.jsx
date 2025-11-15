import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import ManagerJoinPage from "./pages/presentation/manager/JoinPage";
import ManagerPickAnswerQuestion from "./pages/presentation/manager/PickAnswerQuestion";
import ManagerLeaderBoard from "./pages/presentation/manager/LeaderBoard";
import PlayerJoinPage from "./pages/presentation/player/JoinPage";
import PlayerGamePage from "./pages/presentation/player/GamePage";
import PlayerPickAnswerQuestion from "./pages/presentation/player/PickAnswerQuestion";
import PlayerLeaderBoard from "./pages/presentation/player/LeaderBoard";
import Waiting from "./pages/loading/LoadingPage";
import DataWatcher from "./DataWatcher";
import { QuizSetup } from "./data/mockData";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { ServerDataProvider } from "./contexts/ServerDataContext";
import { useServerData } from "./hooks/useServerData";
import { useWebSocket } from "./hooks/useWebSocket";
// import "./App.css";

// export default function App() {
//   return (
//     <Router>
//       <DataWatcher data={data} />
//       <Routes>
//         <Route path="" element={<JoinPage />} />
//         <Route path="/join" element={<JoinPage2 />} />
//         <Route path="/game" element={<GamePage />} />
//         <Route
//           path="/question"
//           element={<PickAnswerQuestion /*question={data}*/ />}
//         />
//         <Route path="/leaderboard" element={<LeaderBoard />} />
//         <Route path="/PollPage" element={<PollPage />} />
//       </Routes>
//     </Router>
//   );
// }

export default function App() {
  // Start the app in the manager flow by default
  const [data, setData] = useState({ type: "PlayerJoinPage" });
  const [currentPage, setCurrentPage] = useState("join"); // join | pollpage | leaderboard
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides] = useState(QuizSetup.slides.length);

  // (Demo mode removed) App now always respects server-driven WebSocket flow.

  // Handle next navigation
  const handleNext = () => {
    if (data.type === "ManagerJoinPage") {
      // Join -> PollPage (no slide increment)
      setData({ type: "ManagerPickAnswerQuestion" });
    } else {
      if (QuizSetup.slides[currentSlide].slide_type === 2) {
        setData({ type: "ManagerLeaderBoard" });
      } else if (QuizSetup.slides[currentSlide].slide_type === 1) {
        setData({ type: "ManagerPickAnswerQuestion" });
      }
      setCurrentSlide((prev) => Math.min(prev + 1, totalSlides));
    }
  };

  // Handle previous navigation
  const handlePrevious = () => {
    if (data.type === "ManagerPickAnswerQuestion" && currentSlide === 1) {
      setData({ type: "ManagerJoinPage" });
    } else {
      if (QuizSetup.slides[currentSlide - 2].slide_type === 2) {
        setData({ type: "ManagerLeaderBoard" });
      } else if (QuizSetup.slides[currentSlide - 2].slide_type === 1) {
        setData({ type: "ManagerPickAnswerQuestion" });
      }
      setCurrentSlide((prev) => Math.max(prev - 1, 1));
    }
  };

  function PageRenderer({ data }) {
    const type = data.type;
    const {
      currentQuestion,
      leaderboardResults,
      questionResults,
      partialQuestionResults,
    } = useServerData();

    // If the app is currently set to a Manager page, always render manager routes
    // so the manager header/footer/navigation remain present even when server
    // messages (like leaderboard or question) arrive.
    if (type && type.startsWith("Manager")) {
      switch (type) {
        case "ManagerJoinPage":
          return (
            <ManagerJoinPage
              onNext={handleNext}
              onPrevious={handlePrevious}
              currentSlide={currentSlide}
              totalSlides={totalSlides}
            />
          );
        case "ManagerPickAnswerQuestion":
          return (
            <ManagerPickAnswerQuestion
              onNext={handleNext}
              onPrevious={handlePrevious}
              currentSlide={currentSlide}
              totalSlides={totalSlides}
            />
          );
        case "ManagerLeaderBoard":
          return (
            <ManagerLeaderBoard
              onNext={handleNext}
              onPrevious={handlePrevious}
              currentSlide={currentSlide}
              totalSlides={totalSlides}
            />
          );
        default:
          return <Waiting />;
      }
    }

    // For non-manager flows, prefer server-driven player rendering.
    if (currentQuestion) {
      const result = questionResults || partialQuestionResults;
      return (
        <PlayerPickAnswerQuestion question={currentQuestion} result={result} />
      );
    }

    if (leaderboardResults) {
      return (
        <PlayerLeaderBoard
          players={leaderboardResults.results || leaderboardResults}
        />
      );
    }

    // Default to player join if in player mode, otherwise waiting
    if (type && type.startsWith("Player")) return <PlayerJoinPage />;

    return <Waiting />;
  }

  // // for quetsion
  // const [data, setData] = useState({
  //   type: "PlayerPickAnswerQuestion",
  //   question_id: 45,
  //   question_text: "Which country has the highest population?",
  //   options: [
  //     { option_id: 47, option_text: "Denmark 🇩🇰" },
  //     { option_id: 48, option_text: "Sweden 🇸🇪" },
  //     { option_id: 49, option_text: "United Kingdom 🇬🇧" },
  //     { option_id: 50, option_text: "France 🇫🇷" },
  //   ],
  //   question_time: 10,
  //   min_point: 0,
  //   max_point: 50,
  // });

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     // for leaderboard data
  //     setData({
  //       type: "PlayerLeaderBoard",
  //       results: [
  //         {
  //           user_id: 1,
  //           name: "Chloe",
  //           character: "👑",
  //           color: "#db2777",
  //           rank: 1,
  //           total_points: 153,
  //           new_points: 61,
  //         },
  //         {
  //           user_id: 2,
  //           name: "Trang",
  //           character: "🌸",
  //           color: "#059669",
  //           rank: 3,
  //           total_points: 149,
  //           new_points: 49,
  //         },
  //         {
  //           user_id: 3,
  //           name: "Alex",
  //           character: "🐱",
  //           color: "#65a30d",
  //           rank: 4,
  //           total_points: 34,
  //           new_points: 34,
  //         },
  //         {
  //           user_id: 4,
  //           name: "Jenny",
  //           character: "🧁",
  //           color: "#2563eb",
  //           rank: 6,
  //           total_points: 0,
  //           new_points: 0,
  //         },
  //         {
  //           user_id: 5,
  //           name: "Kian",
  //           character: "😂",
  //           color: "#4563bb",
  //           rank: 5,
  //           total_points: 20,
  //           new_points: 20,
  //         },
  //         {
  //           user_id: 6,
  //           name: "ALireza",
  //           character: "🫠",
  //           color: "#120854",
  //           rank: 2,
  //           total_points: 150,
  //           new_points: 88,
  //         },
  //       ],
  //     });

  //     // for join page
  //     // setData({ type: "PlayerJoinPage" });
  //   }, 2000);
  //   return () => clearInterval(interval);
  // }, []);

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     const types = [
  //       // "ManagerJoinPage",
  //       // "ManagerPickAnswerQuestion",
  //       // "ManagerLeaderBoard",
  //       "PlayerJoinPage",
  //       // "PlayerGamePage",
  //       "PlayerPickAnswerQuestion",
  //       "PlayerLeaderBoard",
  //       "Waiting",
  //     ];
  //     const randomType = types[Math.floor(Math.random() * types.length)];
  //     // setData({ type: "PlayerPickAnswerQuestion" });
  //     // setData({ type: "PlayerJoinPage" });
  //     // setData({ type: "PlayerJoinPage" });
  //     // setData({ type: "PlayerLeaderBoard" });
  //     setData({ type: randomType });
  //     // setData({ type: "Waiting" });
  //   }, 2000);
  //   return () => clearInterval(interval);
  // }, []);

  // Determine role for WebSocketProvider based on the current page data.type
  const wsRole =
    data?.type && data.type.startsWith("Player") ? "player" : "manager";

  return (
    <ServerDataProvider>
      <WebSocketProvider role={wsRole}>
        <div>
          <PageRenderer data={data} />
          <WSMessageHandler />
        </div>
      </WebSocketProvider>
    </ServerDataProvider>
  );
}

// Forward WebSocket lastMessage into ServerDataContext to update player UI
function WSMessageHandler() {
  const { lastMessage } = useWebSocket();
  const { processMessage } = useServerData();

  useEffect(() => {
    if (!lastMessage) return;
    processMessage(lastMessage);
  }, [lastMessage, processMessage]);

  return null;
}
