import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import {
  Search,
  MoreVertical,
  Pencil,
  Play,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
  LogOut,
  Folder,
  X,
} from "lucide-react";
import ShareMenu from "./ShareMenu";
import { getAuthHeaders } from "../utils/auth";

export default function QuizManager({ onNewPresentation }) {
  const navigate = useNavigate();
  const [loggedInUser, setLoggedInUser] = useState("HesamAzmoun");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load quizzes from API on mount
  const [quizzes, setQuizzes] = useState([]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      // Add a small delay for better UX
      await new Promise((resolve) => setTimeout(resolve, 100));
      const response = await fetch(
        "https://api.proslides.ir/api/quizzes/list/",
        { headers: getAuthHeaders() }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch quizzes");
      }
      const data = await response.json();

      // Map API response to local quiz structure
      const mappedQuizzes = data.results.map((quiz) => ({
        id: quiz.quiz_id,
        name: quiz.quiz_name,
        accessCode: quiz.access_code,
        slides: quiz.slides_count,
        participants: quiz.participants_count,
        members: "",
        createdBy: loggedInUser, // API doesn't provide this, using fallback
        lastUpdated: new Date(quiz.last_update).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        created: new Date(quiz.created_at).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      }));

      setQuizzes(mappedQuizzes);
      setError(null);
    } catch (err) {
      console.error("Error fetching quizzes:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("Recently updated");
  const [showMenu, setShowMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState("bottom"); // 'top' or 'bottom'
  const [showShareModal, setShowShareModal] = useState(null);
  const [templatesExpanded, setTemplatesExpanded] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [renamingQuiz, setRenamingQuiz] = useState(null);
  const [newQuizName, setNewQuizName] = useState("");
  const [selectedQuizzes, setSelectedQuizzes] = useState([]);
  const [deletingQuizIds, setDeletingQuizIds] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    confirmVariant: "default",
    isLoading: false,
    onConfirm: null,
    onClose: null,
  });
  const menuButtonRefs = useRef({});
  const [creatingQuiz, setCreatingQuiz] = useState(false);

  // Create a new quiz via API and navigate to editor
  const handleNewPresentation = async () => {
    try {
      setCreatingQuiz(true);
      const response = await fetch("https://api.proslides.ir/api/quizzes/", {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          title: "Untitled Presentation",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create quiz: ${response.statusText}`);
      }

      const data = await response.json();
      const newQuizId = data.quiz_id;

      if (newQuizId) {
        // Navigate to editor with new quiz ID
        onNewPresentation(newQuizId);
      } else {
        throw new Error("No quiz_id returned from API");
      }
    } catch (err) {
      console.error("Error creating new quiz:", err);
      setError(err.message);
    } finally {
      setCreatingQuiz(false);
    }
  };

  // Helper function to show confirmation dialog
  const showConfirmDialog = (config) => {
    setConfirmDialog({
      isOpen: true,
      title: config.title || "Confirm Action",
      description: config.description || "",
      confirmText: config.confirmText || "Confirm",
      cancelText: config.cancelText || "Cancel",
      confirmVariant: config.confirmVariant || "default",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await config.onConfirm();
        } finally {
          setConfirmDialog((prev) => ({
            ...prev,
            isLoading: false,
            isOpen: false,
          }));
        }
      },
      onClose: () => setConfirmDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  // Helper function to close confirmation dialog
  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  };

  // Helper function to parse date strings in "DD Mon YYYY" format
  const parseDateString = (dateStr) => {
    const months = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    const parts = dateStr.split(" ");
    return new Date(parts[2], months[parts[1]], parts[0]);
  };

  const filteredQuizzes = quizzes
    .filter((quiz) =>
      quiz.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "Recently updated":
          // Sort by lastUpdated descending (newest first)
          return (
            parseDateString(b.lastUpdated) - parseDateString(a.lastUpdated)
          );
        case "Name":
          // Sort by name ascending (A-Z)
          return a.name.localeCompare(b.name);
        case "Created date":
          // Sort by created descending (newest first)
          return parseDateString(b.created) - parseDateString(a.created);
        default:
          return 0;
      }
    });

  // Check if all quizzes are selected
  const allSelected =
    filteredQuizzes.length > 0 &&
    selectedQuizzes.length === filteredQuizzes.length;

  // Check if some quizzes are selected
  const someSelected =
    selectedQuizzes.length > 0 &&
    selectedQuizzes.length < filteredQuizzes.length;

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedQuizzes([]);
    } else {
      setSelectedQuizzes(filteredQuizzes.map((q) => q.id));
    }
  };

  // Handle individual quiz selection
  const handleQuizSelect = (quizId) => {
    setSelectedQuizzes((prev) => {
      if (prev.includes(quizId)) {
        return prev.filter((id) => id !== quizId);
      } else {
        return [...prev, quizId];
      }
    });
  };

  // Delete a single quiz via API
  const deleteQuiz = async (quizId, manageLoadingState = true) => {
    try {
      if (manageLoadingState) {
        setDeletingQuizIds((prev) => [...prev, quizId]);
      }

      const response = await fetch(
        `https://api.proslides.ir/api/quizzes/${quizId}/`,
        {
          method: "DELETE",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete quiz: ${response.statusText}`);
      }

      // Remove from local state immediately
      setQuizzes((prevQuizzes) => prevQuizzes.filter((q) => q.id !== quizId));
      return true;
    } catch (err) {
      console.error("Error deleting quiz:", err);
      setError(err.message);
      return false;
    } finally {
      if (manageLoadingState) {
        setDeletingQuizIds((prev) => prev.filter((id) => id !== quizId));
      }
    }
  };

  // Rename a quiz via API
  const renameQuiz = async (quizId, newName) => {
    try {
      const response = await fetch(
        `https://api.proslides.ir/api/quizzes/${quizId}/`,
        {
          method: "PATCH",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: newName.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to rename quiz: ${response.statusText}`);
      }

      // Update local state on success
      setQuizzes((prevQuizzes) =>
        prevQuizzes.map((q) =>
          q.id === quizId ? { ...q, name: newName.trim() } : q
        )
      );
      return true;
    } catch (err) {
      console.error("Error renaming quiz:", err);
      setError(err.message);
      return false;
    }
  };

  // Reset quiz results via API
  const resetQuizResults = async (quizId) => {
    try {
      const quiz = quizzes.find((q) => q.id === quizId);
      if (!quiz) {
        throw new Error("Quiz not found");
      }

      const response = await fetch(
        `https://api.proslides.ir/api/quizzes/${quizId}/reset-result/`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          // headers: {
          //   "Content-Type": "application/json",
          // },
          // body: JSON.stringify({
          //   title: quiz.name,
          //   author: quiz.createdBy,
          //   access_code: quiz.accessCode,
          //   music_url: "",
          //   background_color: "",
          //   background_image_url: "",
          // }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to reset quiz results: ${response.statusText}`);
      }

      // Show success message
      alert("Quiz results have been reset successfully!");
      return true;
    } catch (err) {
      console.error("Error resetting quiz results:", err);
      setError(err.message);
      return false;
    }
  };

  // Handle move to trash (delete multiple quizzes)
  const handleMoveToTrash = async () => {
    if (selectedQuizzes.length === 0) return;

    showConfirmDialog({
      title: "Delete Quizzes",
      description: `Are you sure you want to delete ${selectedQuizzes.length} quiz(es)? This action cannot be undone.`,
      confirmText: "Delete",
      confirmVariant: "destructive",
      onConfirm: async () => {
        setLoading(true);
        setDeletingQuizIds([...selectedQuizzes]);
        try {
          // Delete all selected quizzes (don't manage loading state individually)
          const deletePromises = selectedQuizzes.map((quizId) =>
            deleteQuiz(quizId, false)
          );
          const results = await Promise.all(deletePromises);

          // Check if all deletions were successful
          const allSucceeded = results.every((result) => result === true);

          if (allSucceeded) {
            setSelectedQuizzes([]);
            setError(null);
            // Refresh the quiz list to ensure consistency
            await fetchQuizzes();
          } else {
            setError("Some quizzes could not be deleted. Please try again.");
            // Refresh the quiz list to sync with server
            await fetchQuizzes();
          }
        } catch (err) {
          console.error("Error deleting quizzes:", err);
          setError(err.message);
          // Refresh the quiz list even on error to sync with server
          await fetchQuizzes();
        } finally {
          setLoading(false);
          setDeletingQuizIds([]);
        }
      },
    });
  };

  // Handle delete single quiz from hamburger menu
  const handleDeleteQuiz = async (quizId) => {
    showConfirmDialog({
      title: "Delete Quiz",
      description:
        "Are you sure you want to delete this quiz? This action cannot be undone.",
      confirmText: "Delete",
      confirmVariant: "destructive",
      onConfirm: async () => {
        setShowMenu(null);
        setLoading(true);
        try {
          const success = await deleteQuiz(quizId);
          if (success) {
            setError(null);
            // Refresh the quiz list to ensure consistency
            await fetchQuizzes();
          } else {
            setError("Failed to delete quiz. Please try again.");
          }
        } catch (err) {
          console.error("Error deleting quiz:", err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Handle select all from bottom bar
  const handleBottomBarSelectAll = () => {
    setSelectedQuizzes(filteredQuizzes.map((q) => q.id));
  };

  // Generate unique access code
  const generateAccessCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    let isUnique = false;

    while (!isUnique) {
      code = "";
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      // Check if code is unique
      isUnique = !quizzes.some((q) => q.accessCode === code);
    }

    return code;
  };

  // Handle duplicate quiz via API
  const handleDuplicate = async (quiz) => {
    try {
      // Find how many copies already exist to generate appropriate name
      const copyRegex = new RegExp(
        `^${quiz.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\copy (\\d+)\\$`
      );
      let maxCopyNumber = 0;

      quizzes.forEach((q) => {
        const match = q.name.match(copyRegex);
        if (match) {
          const copyNum = parseInt(match[1]);
          if (copyNum > maxCopyNumber) {
            maxCopyNumber = copyNum;
          }
        }
      });

      const newName = `${quiz.name} (copy ${maxCopyNumber + 1})`;

      const response = await fetch(
        `https://api.proslides.ir/api/quizzes/${quiz.id}/duplicate/`,
        {
          method: "POST",
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            title: newName,
            author: quiz.createdBy,
            access_code: generateAccessCode(), // Generate new access code for duplicate
            music_url: "",
            background_color: "",
            background_image_url: "",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to duplicate quiz: ${response.statusText}`);
      }

      const duplicatedQuizData = await response.json();

      // Add the duplicated quiz to local state
      // Assuming the API returns the new quiz data, map it to our local format
      const newQuiz = {
        id: duplicatedQuizData.quiz_id || duplicatedQuizData.id,
        name: duplicatedQuizData.quiz_name || duplicatedQuizData.title,
        accessCode: duplicatedQuizData.access_code,
        slides: duplicatedQuizData.slides_count || quiz.slides,
        participants:
          duplicatedQuizData.participants_count || quiz.participants,
        members: "",
        createdBy: quiz.createdBy,
        lastUpdated: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        created: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };

      setQuizzes([...quizzes, newQuiz]);
      alert("Quiz duplicated successfully!");
    } catch (err) {
      console.error("Error duplicating quiz:", err);
      setError(err.message);
    } finally {
      setShowMenu(null);
    }
  };

  // Handle present click
  const handlePresent = (quizId) => {
    navigate(`/manager/presentation/${quizId}/`);
  };
  // Handle edit click
  const handleEdit = (quizId) => {
    navigate(`/manager/panel/${quizId}/`);
  };

  // Check menu position and adjust if needed
  const checkMenuPosition = (quizId, buttonElement) => {
    if (!buttonElement) return;

    const rect = buttonElement.getBoundingClientRect();
    const menuHeight = 350; // Approximate height of menu in pixels
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    // If there's more space below, show menu below; otherwise show above
    if (spaceBelow >= menuHeight || spaceAbove < spaceBelow) {
      setMenuPosition("bottom");
    } else {
      setMenuPosition("top");
    }
  };

  // Handle menu toggle with position check
  const handleMenuToggle = (quizId, e) => {
    e.stopPropagation();
    const buttonElement = menuButtonRefs.current[quizId];

    if (showMenu === quizId) {
      setShowMenu(null);
    } else {
      setShowMenu(quizId);
      // Use requestAnimationFrame to ensure DOM is ready before checking position
      requestAnimationFrame(() => {
        if (buttonElement) {
          checkMenuPosition(quizId, buttonElement);
        }
      });
    }
  };

  // Recalculate menu position on scroll and resize
  useEffect(() => {
    if (showMenu) {
      const handlePositionUpdate = () => {
        const buttonElement = menuButtonRefs.current[showMenu];
        if (buttonElement) {
          checkMenuPosition(showMenu, buttonElement);
        }
      };

      window.addEventListener("scroll", handlePositionUpdate, true);
      window.addEventListener("resize", handlePositionUpdate);

      return () => {
        window.removeEventListener("scroll", handlePositionUpdate, true);
        window.removeEventListener("resize", handlePositionUpdate);
      };
    }
  }, [showMenu]);

  return (
    <div className="min-h-screen bg-blue-50 pb-30">
      {/* Header */}
      <div className="min-h-screen mx-auto mb-8">
        {/* Top Navigation Bar with Search */}
        <div className="bg-white fixed top-0 left-0 right-0 w-full h-16 flex items-center justify-between px-6 z-50 shadow-sm">
          <div className="text-black font-semibold text-lg flex items-center gap-1.5 before:content-['✱'] before:text-xl">
            ProSlides
          </div>

          <div className="relative flex-1 max-w-md mx-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search presentations.."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 border border-gray-300 text-gray-700 bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
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
                      setShowProfileMenu(false);
                      // Add logout logic here
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
        <div className="pt-24 px-6">
          {/* My Presentations Section */}
          <div className="mb-6">
            {/* <h3 className="text-xs uppercase text-gray-500 mb-2">
              MY PRESENTATIONS
            </h3> */}
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              My presentations
            </h2>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-3">
                <Button
                  onClick={handleNewPresentation}
                  disabled={creatingQuiz}
                  className="bg-blue-800 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingQuiz ? (
                    <>
                      <span className="animate-spin">⏳</span> Creating...
                    </>
                  ) : (
                    <>
                      <span className="text-xl mb-1">+</span> New presentation
                    </>
                  )}
                </Button>
                {/* <Button
                  variant="outline"
                  className="border-gray-300 bg-white text-gray-700 px-6 py-2.5 rounded-lg"
                >
                  Import
                </Button> */}
                {/* <Button
                  variant="outline"
                  className="border-gray-300 bg-white text-gray-700 px-6 py-2.5 rounded-lg"
                >
                  New folder
                </Button> */}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Sort by</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none border border-gray-300 bg-white rounded-lg pl-4 pr-10 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  >
                    <option>Recently updated</option>
                    <option>Name</option>
                    <option>Created date</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Quiz Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
              <table className="w-full ">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      Name
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      Access code
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      Created by
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      Last updated
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      Created
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600"></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredQuizzes.map((quiz) => (
                    <tr
                      key={quiz.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition relative group ${
                        selectedQuizzes.includes(quiz.id) ? "bg-blue-50" : ""
                      } ${
                        deletingQuizIds.includes(quiz.id)
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={selectedQuizzes.includes(quiz.id)}
                          onChange={() => handleQuizSelect(quiz.id)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded flex items-center justify-center text-white text-2xl">
                            🎯
                          </div>
                          <div>
                            {renamingQuiz === quiz.id ? (
                              <input
                                type="text"
                                value={newQuizName}
                                onChange={(e) => setNewQuizName(e.target.value)}
                                onBlur={async () => {
                                  if (
                                    newQuizName.trim() &&
                                    newQuizName.trim() !== quiz.name
                                  ) {
                                    const success = await renameQuiz(
                                      quiz.id,
                                      newQuizName
                                    );
                                    if (!success) {
                                      // Revert to original name if API call failed
                                      setNewQuizName(quiz.name);
                                    }
                                  }
                                  setRenamingQuiz(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.target.blur();
                                  } else if (e.key === "Escape") {
                                    setRenamingQuiz(null);
                                  }
                                }}
                                autoFocus
                                className="font-semibold text-gray-800 border border-purple-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            ) : (
                              <div className="font-semibold text-gray-800">
                                {quiz.name}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <span>📄 {quiz.slides}</span>
                              <span>👥 {quiz.participants}</span>
                              <span className="text-gray-400">
                                {quiz.members}
                              </span>
                              <button
                                onClick={() =>
                                  navigate(`/manager/panel/${quiz.id}/report`)
                                }
                                className="mt-2 mb-1 inline-flex items-center bg-purple-100 hover:bg-purple-600 text-[#6D28D9] hover:text-white px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-colors"
                              >
                                <svg
                                  className="w-4 h-4 mr-0.5 flex-shrink-0"
                                  viewBox="0 0 30 30"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <rect
                                    x="3"
                                    y="15"
                                    width="6"
                                    height="9"
                                    rx="0.5"
                                    fill="currentColor"
                                  />
                                  <rect
                                    x="12"
                                    y="7"
                                    width="6"
                                    height="17"
                                    rx="0.5"
                                    fill="currentColor"
                                  />
                                  <rect
                                    x="21"
                                    y="11"
                                    width="6"
                                    height="13"
                                    rx="0.5"
                                    fill="#C4B5FD"
                                  />
                                </svg>
                                Report
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 group/access">
                          <span
                            onClick={() => setShowShareModal(quiz.id)}
                            className="text-purple-600 font-semibold cursor-pointer hover:text-purple-700 transition"
                          >
                            {quiz.accessCode}
                          </span>
                          <button
                            onClick={() => setShowShareModal(quiz.id)}
                            className="p-1 hover:bg-gray-200 rounded transition opacity-0 group-hover/access:opacity-100"
                          >
                            <Pencil className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                            {quiz.createdBy
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <span className="text-gray-700">
                            {quiz.createdBy}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {quiz.lastUpdated}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {quiz.created}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            onClick={() => handleEdit(quiz.id)}
                            className="bg-blue-800 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => handlePresent(quiz.id)}
                            className="bg-purple-800 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Present
                          </Button>
                          <div className="relative">
                            <button
                              ref={(el) =>
                                (menuButtonRefs.current[quiz.id] = el)
                              }
                              onClick={(e) => handleMenuToggle(quiz.id, e)}
                              className="p-2 hover:bg-gray-200 rounded transition"
                            >
                              <MoreVertical className="w-5 h-5 text-gray-600" />
                            </button>
                            {showMenu === quiz.id && (
                              <div
                                className={`absolute right-0 ${
                                  menuPosition === "top"
                                    ? "bottom-full mb-2"
                                    : "top-full mt-2"
                                } bg-white border border-gray-200 rounded-lg shadow-lg w-48 z-[60] max-h-[80vh] overflow-y-auto`}
                              >
                                <button
                                  onClick={() => handlePresent(quiz.accessCode)}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-purple-600 font-medium"
                                >
                                  <Play className="w-4 h-4" />
                                  Present
                                </button>
                                <button
                                  onClick={() => {
                                    setRenamingQuiz(quiz.id);
                                    setNewQuizName(quiz.name);
                                    setShowMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Rename
                                </button>
                                <button
                                  onClick={() => {
                                    showConfirmDialog({
                                      title: "Reset Quiz Results",
                                      description:
                                        "Are you sure you want to reset all results for this quiz? This action cannot be undone.",
                                      confirmText: "Reset Results",
                                      confirmVariant: "destructive",
                                      onConfirm: async () => {
                                        await resetQuizResults(quiz.id);
                                        setShowMenu(null);
                                      },
                                    });
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <Copy className="w-4 h-4" />
                                  Reset results
                                </button>
                                <button
                                  onClick={() => handleDuplicate(quiz)}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <Copy className="w-4 h-4" />
                                  Duplicate
                                </button>
                                <button
                                  onClick={() => {
                                    setShowShareModal(quiz.id);
                                    setShowMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <span className="w-4 h-4 pb-5">🔗</span>
                                  Share
                                </button>
                                {/* <button className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
                                  <span className="w-4 h-4">📁</span>
                                  Move to
                                </button> */}
                                <button
                                  onClick={() => handleDeleteQuiz(quiz.id)}
                                  className="w-full text-left px-4 py-3 text-red-400 hover:bg-red-50 flex items-center gap-3  border-t border-gray-200"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Move to Trash
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 mt-15 border-b-2 border-purple-600"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
                Error: {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareMenu
          isOpen={true}
          onClose={() => setShowShareModal(null)}
          quizId={showShareModal}
          accessCode={quizzes.find((q) => q.id === showShareModal)?.accessCode}
        />
      )}

      {/* Bottom Action Bar */}
      {selectedQuizzes.length > 0 && (
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 mb-8 z-50">
          <div className="bg-[#4A5568] text-white rounded-lg shadow-2xl px-6 py-4 flex items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedQuizzes.length} selected
              </span>
              {!allSelected && (
                <button
                  onClick={handleBottomBarSelectAll}
                  className="text-sm hover:text-gray-300 transition flex items-center gap-2"
                >
                  <span className="text-lg">⚡</span>
                  Select all
                </button>
              )}
              {/* <button className="text-sm hover:text-gray-300 transition flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Move to
              </button> */}
              <button
                onClick={handleMoveToTrash}
                className="text-sm text-red-400 hover:text-red-200 transition flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Move to Trash
              </button>
            </div>
            <button
              onClick={() => setSelectedQuizzes([])}
              className="ml-4 hover:bg-gray-600 rounded p-1 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Close menu when clicking outside */}
      {(showMenu || showProfileMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowMenu(null);
            setShowProfileMenu(false);
          }}
        ></div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={confirmDialog.onClose}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmVariant={confirmDialog.confirmVariant}
        isLoading={confirmDialog.isLoading}
      />
    </div>
  );
}
