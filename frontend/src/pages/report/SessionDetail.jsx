import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Search, LogOut, Home } from "lucide-react";
import { apiFetch } from "../../utils/apiFetch";
import { clearAuthStorage, getRefreshToken } from "../../utils/auth";

export default function SessionDetail() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("participants");
  const [searchQuery, setSearchQuery] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState("HesamAzmoun");
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(
          `/quizzes/${quizId}/final-leaderboard/`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setLeaderboardData(data.leaderboard || []);
        setError(null);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      fetchLeaderboard();
    }
  }, [quizId]);

  const filteredParticipants = leaderboardData.filter((participant) =>
    participant.player_name
      .toLowerCase()
      .includes(participantSearchQuery.toLowerCase())
  );

  const calculateScorePercentage = (score) => {
    if (leaderboardData.length === 0) return 0;
    const maxScore = Math.max(...leaderboardData.map((p) => p.score));
    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    try {
      const refresh = getRefreshToken();
      if (refresh) {
        const response = await apiFetch("/auth/logout/", {
          method: "POST",
          json: { refresh },
        });
        if (!response.ok) {
          console.warn("Logout request failed:", response.statusText);
        }
      }
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      clearAuthStorage();
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-800">
      {/* Top Navigation Bar with Search */}
      <div className="bg-white fixed top-0 left-0 right-0 w-full h-16 flex items-center justify-between px-6 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/manager/panel")}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Home className="w-5 h-5" />
          </button>
          <div className="text-black font-semibold text-lg flex items-center gap-1.5 before:content-['✱'] before:text-xl">
            ProSlides
          </div>
        </div>

        <div className="relative flex-1 max-w-md mx-8">
          {/* <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search presentations.."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 border border-gray-300 text-gray-700 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          /> */}
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <span className="text-xl">🌐</span>
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition relative">
            <span className="text-xl">🔔</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <span className="text-xl">❓</span>
          </button>
          <button className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition font-medium">
            Upgrade
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer hover:bg-teal-600 transition"
            >
              {loggedInUser.charAt(0).toUpperCase()}
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg w-48 z-50">
                <button
                  onClick={() => {
                    handleLogout();
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content with top padding to account for fixed header */}
      <div className="pt-24 px-6 bg-blue-50 min-h-screen">
        <div className="max-w-8xl mx-auto py-8 ">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Report / Session Detail
          </div>
          <h1 className="text-3xl font-bold mb-2">My Quiz</h1>
          <p className="text-sm text-gray-500 mb-6">
            Report updated in a few seconds · Refreshes every 15 minutes
          </p>

          {/* Tabs */}
          <div className="full-border rounded-xl bg-white shadow-sm">
            <div className="px-6 pt-4">
              <div className="flex gap-6">
                <button
                  className={`pb-3 text-sm font-semibold ${
                    activeTab === "participants"
                      ? "text-purple-700 border-b-2 border-purple-700"
                      : "text-gray-500"
                  }`}
                  onClick={() => setActiveTab("participants")}
                >
                  Participants ({filteredParticipants.length})
                </button>
                {/* <button
                className={`pb-3 text-sm font-semibold ${
                  activeTab === "feedback"
                    ? "text-purple-700 border-b-2 border-purple-700"
                    : "text-gray-500"
                }`}
                onClick={() => setActiveTab("feedback")}
              >
                Feedback (0)
              </button> */}
              </div>
            </div>

            {activeTab === "participants" && (
              <div className="px-6 pb-6">
                {/* Search */}
                <div className="my-4">
                  <div className="relative max-w-md">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      🔍
                    </span>
                    <input
                      placeholder="Search participants..."
                      value={participantSearchQuery}
                      onChange={(e) =>
                        setParticipantSearchQuery(e.target.value)
                      }
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* Loading State */}
                {loading && (
                  <div className="text-center py-8 text-gray-500">
                    Loading leaderboard data...
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="text-center py-8 text-red-500">
                    Error loading data: {error}
                  </div>
                )}

                {/* Table */}
                {!loading && !error && (
                  <>
                    <div className="flex overflow-x-auto">
                      <table className="w-[80%] text-sm border-collapse table-fixed">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left font-semibold py-3 w-[10%]">
                              Rank
                            </th>
                            <th className="text-left font-semibold w-[25%]">
                              Name
                            </th>
                            <th className="text-left font-semibold py-3 w-[65%]">
                              Score
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {filteredParticipants.length > 0 ? (
                            filteredParticipants.map((participant, index) => {
                              const scorePercentage = calculateScorePercentage(
                                participant.score
                              );
                              // Clean up player name and avatar (remove quotes if present)
                              const cleanName = participant.player_name.replace(
                                /^"|"$/g,
                                ""
                              );
                              const cleanAvatar = participant.avatar.replace(
                                /^"|"$/g,
                                ""
                              );
                              // Define distinct colors for progress bars
                              const progressColors = [
                                "bg-blue-500", // 1st place
                                "bg-yellow-500", // 2rd place
                                "bg-red-500", // 3th place
                                "bg-green-500", // 4nd place
                                "bg-indigo-500", // 5th place
                                "bg-pink-500", // 6th place
                                "bg-teal-500", // 7th place
                                "bg-orange-500", // 8th place
                                "bg-cyan-500", // 9th place
                                "bg-lime-500", // 10th place
                              ];
                              const progressColor =
                                progressColors[index % progressColors.length];

                              // Check if player is in top 3 for green background
                              const isTopThree = participant.rank <= 3;

                              return (
                                <tr
                                  key={participant.rust_session_id || index}
                                  className={`border-t ${
                                    isTopThree ? "bg-green-100" : ""
                                  }`}
                                >
                                  <td className="py-4 pl-3">
                                    {participant.rank}
                                  </td>
                                  <td className="py-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xl">
                                        {cleanAvatar}
                                      </span>
                                      <span>{cleanName}</span>
                                      {participant.rank === 1 && (
                                        <span className="text-yellow-500 text-lg">
                                          🏆
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4">
                                    <div className="flex items-center gap-3 w-full">
                                      <span className="shrink-0">
                                        {participant.score}
                                      </span>
                                      <div className="flex h-6 rounded-md overflow-hidden border border-gray-200 w-full">
                                        <div
                                          className={`${progressColor} transition-all duration-300`}
                                          style={{
                                            width: `${scorePercentage}%`,
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr className="border-t">
                              <td
                                colSpan="3"
                                className="py-4 text-center text-gray-500"
                              >
                                No participants found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer */}
                    <div className="text-sm text-gray-600 mt-6">
                      Total {filteredParticipants.length} participant(s)
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "feedback" && (
              <div className="px-6 pb-6 text-sm text-gray-600">
                No feedback yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close menu when clicking outside */}
      {showProfileMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowProfileMenu(false);
          }}
        ></div>
      )}
    </div>
  );
}
