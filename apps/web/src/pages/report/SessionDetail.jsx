import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Home, LogOut, Search, Trophy } from "lucide-react";
import { apiFetch } from "../../utils/apiFetch";
import { clearAuthStorage } from "../../utils/auth";
import { quizService } from "../../services/quizService.ts";
import { getRosterPage } from "../../live/liveApi";

export default function SessionDetail() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("participants");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loggedInUser] = useState(
    () => localStorage.getItem("auth.name") || "You"
  );
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [nextCursor, setNextCursor] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const fetchQuizTitle = useCallback(async (signal) => {
    if (!quizId) return;
    try {
      const data = await quizService.getQuiz(quizId, { signal });
      if (data?.title) {
        setQuizTitle(data.title);
      }
    } catch (err) {
      if (signal?.aborted || err?.name === "AbortError") return;
      console.warn("Error fetching quiz title:", err);
    }
  }, [quizId]);

  const fetchLeaderboard = useCallback(
    async (isManualRefresh = false, signal) => {
      try {
        if (isManualRefresh) {
          setIsRefreshing(true);
        } else {
          setLoading(true);
        }
        const locator = await quizService.getLatestSession(quizId, { signal });
        const page = await getRosterPage(locator.session_id, "score", "", 100, signal);
        setSessionId(locator.session_id);
        setLeaderboardData(page.items.map((item, index) => ({
          player_id: item.participant_id,
          player_name: item.display_name,
          avatar: item.avatar || "",
          score: item.score,
          rank: index + 1,
        })));
        setNextCursor(page.next_cursor || "");
        setHasMore(page.has_more);
        setError(null);

        setLastUpdated(new Date());
      } catch (err) {
        if (signal?.aborted || err?.name === "AbortError") return;
        if (err?.response?.status === 404 || err?.status === 404) {
          setLeaderboardData([]);
          setHasMore(false);
          setError(null);
        } else {
          console.error("Error fetching leaderboard:", err);
          setError(err.message);
        }
      } finally {
        if (!signal?.aborted) {
          if (isManualRefresh) {
            setIsRefreshing(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [quizId]
  );

  useEffect(() => {
    if (!quizId) return;
    const controller = new AbortController();
    fetchQuizTitle(controller.signal);
    fetchLeaderboard(false, controller.signal);
    const intervalId = setInterval(() => {
      fetchLeaderboard(false, controller.signal);
    }, 15 * 60 * 1000);
    return () => {
      controller.abort();
      clearInterval(intervalId);
    };
  }, [fetchLeaderboard, fetchQuizTitle, quizId]);

  const loadMore = async () => {
    if (!sessionId || !nextCursor || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const page = await getRosterPage(sessionId, "score", nextCursor, 100);
      setLeaderboardData((current) => [
        ...current,
        ...page.items.map((item, index) => ({
          player_id: item.participant_id,
          player_name: item.display_name,
          avatar: item.avatar || "",
          score: item.score,
          rank: current.length + index + 1,
        })),
      ]);
      setNextCursor(page.next_cursor || "");
      setHasMore(page.has_more);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredParticipants = leaderboardData.filter((participant) =>
    String(participant.player_name || "")
      .toLowerCase()
      .includes(participantSearchQuery.toLowerCase())
  );
  const totalParticipants = leaderboardData.length;
  const filteredCount = filteredParticipants.length;

  const calculateScorePercentage = (score) => {
    if (leaderboardData.length === 0) return 0;
    const maxScore = Math.max(
      ...leaderboardData.map((p) => Number(p.score) || 0)
    );
    return maxScore > 0 ? (score / maxScore) * 100 : 0;
  };

  const handleLogout = async () => {
    setShowProfileMenu(false);
    try {
      const response = await apiFetch("/auth/logout", { method: "POST" });
      if (!response.ok) {
        console.warn("Logout request failed:", response.statusText);
      }
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      clearAuthStorage();
      navigate("/auth");
    }
  };

  const quizLabel =
    quizTitle?.trim() || (quizId ? `Quiz ${quizId}` : "Quiz");

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-800">
      {/* Top Navigation Bar with Search */}
      <div className="bg-white fixed top-0 left-0 right-0 w-full h-16 flex items-center justify-between px-6 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/manager/panel")}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Back to manager panel"
            title="Back to panel"
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
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Language"
            title="Language"
          >
            <span className="text-xl">🌐</span>
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition relative"
            aria-label="Notifications"
            title="Notifications"
          >
            <span className="text-xl">🔔</span>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Help"
            title="Help"
          >
            <span className="text-xl">❓</span>
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer hover:bg-teal-600 transition"
              aria-label="Open profile menu"
              title="Profile"
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
      <div className="pt-24 px-6 bg-slate-100 min-h-screen">
        <div className="max-w-6xl mx-auto py-8">
          <div className="text-xs text-gray-600 uppercase tracking-wider mb-3">
            Report / {quizLabel}
          </div>
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold text-slate-900">
                  {quizLabel}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {lastUpdated
                    ? `Updated at ${lastUpdated.toLocaleTimeString()} - Refreshes every 15 minutes`
                    : "Updates automatically every 15 minutes"}
                </p>
              </div>
              <button
                onClick={() => fetchLeaderboard(true)}
                disabled={isRefreshing}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Tabs */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200">
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
                  Participants
                  {participantSearchQuery
                    ? ` (${filteredCount} / ${totalParticipants})`
                    : ` (${totalParticipants})`}
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
                <div className="my-4 md:sticky md:top-24 md:z-10 md:bg-white md:py-4">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      placeholder="Search participants..."
                      value={participantSearchQuery}
                      onChange={(e) =>
                        setParticipantSearchQuery(e.target.value)
                      }
                      className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {participantSearchQuery && (
                      <button
                        onClick={() => setParticipantSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                        title="Clear search"
                      >
                        Clear
                      </button>
                    )}
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
                    <div className="hidden md:flex overflow-x-auto">
                      <table className="min-w-[640px] w-full text-sm border-collapse table-fixed">
                        <thead>
                          <tr className="text-slate-500">
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
                              const scoreValue = Number(participant.score) || 0;
                              const scorePercentage =
                                calculateScorePercentage(scoreValue);
                              // Clean up player name and avatar (remove quotes if present)
                              const cleanName = String(
                                participant.player_name || "Player"
                              ).replace(/^"|"$/g, "");
                              const cleanAvatar = String(
                                participant.avatar || ""
                              ).replace(/^"|"$/g, "");
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

                              // Check if player is in top 3 for accent background
                              const rankValue =
                                Number(participant.rank) || index + 1;
                              const isTopThree = rankValue <= 3;
                              const rankBadge =
                                rankValue === 1
                                  ? {
                                      label: "Gold",
                                      className: "bg-amber-100 text-amber-700",
                                    }
                                  : rankValue === 2
                                    ? {
                                        label: "Silver",
                                        className: "bg-slate-100 text-slate-600",
                                      }
                                    : rankValue === 3
                                      ? {
                                          label: "Bronze",
                                          className: "bg-orange-100 text-orange-700",
                                        }
                                      : null;

                              return (
                                <tr
                                  key={
                                    participant.rust_session_id ||
                                    participant.player_id ||
                                    index
                                  }
                                  className={`border-t ${
                                    isTopThree ? "bg-emerald-50/70" : ""
                                  }`}
                                >
                                  <td className="py-4 pl-3">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                                          isTopThree
                                            ? "border-amber-200 bg-white text-slate-800"
                                            : "border-slate-200 text-slate-600"
                                        }`}
                                      >
                                        {rankValue}
                                      </span>
                                      {rankBadge && (
                                        <span
                                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${rankBadge.className}`}
                                        >
                                          <Trophy className="h-3.5 w-3.5" />
                                          {rankBadge.label}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4">
                                    <div className="flex items-center gap-2">
                                      {cleanAvatar && (
                                        <span className="text-xl">
                                          {cleanAvatar}
                                        </span>
                                      )}
                                      <span className="font-semibold text-slate-900">
                                        {cleanName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-4">
                                    <div className="flex items-center gap-3 w-full">
                                      <span className="shrink-0 font-semibold text-slate-900">
                                        {scoreValue}
                                      </span>
                                      <div className="flex h-6 rounded-md overflow-hidden border border-slate-200 bg-slate-50 w-full">
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
                                className="py-6 text-center text-slate-500"
                              >
                                <div className="flex flex-col items-center gap-2 py-10">
                                  <Trophy className="h-8 w-8 text-slate-300" />
                                  <span className="text-sm font-medium text-slate-600">
                                    {participantSearchQuery
                                      ? "No participants match your search."
                                      : "No participants yet."}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden space-y-3">
                      {filteredParticipants.length > 0 ? (
                        filteredParticipants.map((participant, index) => {
                          const scoreValue = Number(participant.score) || 0;
                          const scorePercentage =
                            calculateScorePercentage(scoreValue);
                          const cleanName = String(
                            participant.player_name || "Player"
                          ).replace(/^"|"$/g, "");
                          const cleanAvatar = String(
                            participant.avatar || ""
                          ).replace(/^"|"$/g, "");
                          const progressColors = [
                            "bg-blue-500",
                            "bg-yellow-500",
                            "bg-red-500",
                            "bg-green-500",
                            "bg-indigo-500",
                            "bg-pink-500",
                            "bg-teal-500",
                            "bg-orange-500",
                            "bg-cyan-500",
                            "bg-lime-500",
                          ];
                          const progressColor =
                            progressColors[index % progressColors.length];
                          const rankValue =
                            Number(participant.rank) || index + 1;
                          const isTopThree = rankValue <= 3;

                          return (
                            <div
                              key={
                                participant.rust_session_id ||
                                participant.player_id ||
                                index
                              }
                              className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${
                                isTopThree ? "ring-1 ring-emerald-200" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs uppercase tracking-wide text-slate-500">
                                    Rank
                                  </span>
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-700">
                                    {rankValue}
                                  </span>
                                </div>
                                <span className="text-sm font-semibold text-slate-900">
                                  {scoreValue} pts
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                {cleanAvatar && (
                                  <span className="text-lg">{cleanAvatar}</span>
                                )}
                                <span className="text-sm font-semibold text-slate-900">
                                  {cleanName}
                                </span>
                              </div>
                              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={progressColor}
                                  style={{ width: `${scorePercentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                          {participantSearchQuery
                            ? "No participants match your search."
                            : "No participants yet."}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="text-sm text-slate-600 mt-6">
                      Total {totalParticipants} participant(s)
                    </div>
                    {hasMore && (
                      <button
                        onClick={loadMore}
                        disabled={isRefreshing}
                        className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {isRefreshing ? "Loading..." : "Load 100 more"}
                      </button>
                    )}
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
