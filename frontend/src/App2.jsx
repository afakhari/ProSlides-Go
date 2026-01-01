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

export default function App() {
  // Start the app in the manager flow by default
  const [data, setData] = useState({ type: "ManagerJoinPage" });
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
