import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { ErrorModal } from "../pages/quiz/manager/ErrorModal";
import { quizService } from "../services/quizService.ts";
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
  LoaderCircle,
  Plus,
} from "lucide-react";
import ShareMenu from "./ShareMenu";
import { apiFetch } from "../utils/apiFetch";
import { clearAuthStorage } from "../utils/auth";
import { getPresentationValidationError } from "../pages/quiz/manager/questionValidation";
import { createPresentationOnce } from "../modules/presentations/model/createPresentationFlow.ts";

const safeTimestamp = (value) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
};

const formatDate = (timestamp) =>
  timestamp
    ? new Date(timestamp).toLocaleDateString("fa-IR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

export default function QuizManager({ onNewPresentation }) {
  const navigate = useNavigate();
  const [loggedInUser] = useState(
    () => localStorage.getItem("auth.name") || "شما"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordPromptStatus, setPasswordPromptStatus] = useState(null);
  const [passwordPromptLoading, setPasswordPromptLoading] = useState(false);
  const [errorForModal, setErrorForModal] = useState(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const closeErrorModal = () => {
    setErrorModalOpen(false);
  };

  // Load quizzes from API on mount
  const [quizzes, setQuizzes] = useState([]);

  const fetchQuizzes = useCallback(async (signal) => {
    try {
      setLoading(true);
      const data = await quizService.listPresentations({ signal });

      // Map API response to local quiz structure
      const mappedQuizzes = data.map((quiz) => {
        const updatedAt = safeTimestamp(quiz.updated_at);
        const createdAt = safeTimestamp(quiz.created_at);
        return {
          id: quiz.id,
          revision: Number(quiz.revision || 1),
          name: quiz.title,
          accessCode: quiz.access_code || "",
          slides: quiz.slide_count,
          participants: quiz.participant_count,
          members: "",
          createdBy: quiz.owner_full_name || quiz.owner_name || loggedInUser,
          lastUpdated: formatDate(updatedAt),
          created: formatDate(createdAt),
          updatedAt,
          createdAt,
        };
      });

      setQuizzes(mappedQuizzes);
      setError(null);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Error fetching quizzes:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loggedInUser]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchQuizzes(controller.signal);
    return () => controller.abort();
  }, [fetchQuizzes]);

  useEffect(() => {
    if (!statusMessage) return;
    const timeoutId = setTimeout(() => setStatusMessage(null), 3000);
    return () => clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    const promptFlag = localStorage.getItem("auth.promptSetPassword");
    const email = localStorage.getItem("auth.email");
    if (promptFlag && email) {
      setPasswordPromptVisible(true);
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("Recently updated");
  const [showMenu, setShowMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState("bottom"); // 'top' or 'bottom'
  const [showShareModal, setShowShareModal] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
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
  const [creationError, setCreationError] = useState(null);
  const creationGateRef = useRef(false);

  // Create a new quiz via API and navigate to editor
  const handleNewPresentation = async () => {
    if (creationGateRef.current) return;
    try {
      setCreatingQuiz(true);
      setCreationError(null);
      await createPresentationOnce({
        gate: creationGateRef,
        create: quizService.createPresentation,
        navigate: onNewPresentation,
      });
    } catch (err) {
      console.error("Error creating new quiz:", err);
      setCreationError(
        "ارائه ساخته نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید."
      );
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

  // Helper function to parse date strings in "DD Mon YYYY" format
  const filteredQuizzes = quizzes
    .filter((quiz) =>
      quiz.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "Recently updated":
          // Sort by lastUpdated descending (newest first)
          return b.updatedAt - a.updatedAt;
        case "Name":
          // Sort by name ascending (A-Z)
          return a.name.localeCompare(b.name);
        case "Created date":
          // Sort by created descending (newest first)
          return b.createdAt - a.createdAt;
        default:
          return 0;
      }
    });

  // Check if all quizzes are selected
  const selectedInFilterCount = filteredQuizzes.filter((quiz) =>
    selectedQuizzes.includes(quiz.id)
  ).length;

  // Check if all quizzes are selected within the current filter
  const allSelected =
    filteredQuizzes.length > 0 &&
    selectedInFilterCount === filteredQuizzes.length;

  // Check if some quizzes are selected within the current filter
  const someSelected = selectedInFilterCount > 0 && !allSelected;
  const showEmptyState = !loading && !error && filteredQuizzes.length === 0;

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

      await quizService.deletePresentation(quizId);

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
      const currentQuiz = quizzes.find((quiz) => quiz.id === quizId);
      const updated = await quizService.updateQuiz(quizId, {
        title: newName.trim(),
        revision: currentQuiz?.revision,
      });

      // Update local state on success
      const now = Date.now();
      setQuizzes((prevQuizzes) =>
        prevQuizzes.map((q) =>
          q.id === quizId
            ? {
                ...q,
                name: newName.trim(),
                revision: updated.revision,
                updatedAt: now,
                lastUpdated: formatDate(now),
              }
            : q
        )
      );
      return true;
    } catch (err) {
      console.error("Error renaming quiz:", err);
      if (err.response?.status === 409 && err.response?.data?.error === "edit_conflict") {
        await fetchQuizzes();
        setError("This presentation changed elsewhere. The latest version has been loaded.");
      } else {
        setError(err.message);
      }
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

      await quizService.resetPresentationResults(quizId);

      setStatusMessage({
        type: "success",
        message: "Quiz results have been reset successfully.",
      });
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
      title: "حذف ارائه‌ها",
      description: `آیا از حذف ${selectedQuizzes.length} ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.`,
      confirmText: "حذف",
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
      title: "حذف ارائه",
      description:
        "آیا از حذف این ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.",
      confirmText: "حذف",
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

  // Handle duplicate quiz via API
  const handleDuplicate = async (quiz) => {
    try {
      // Find how many copies already exist to generate appropriate name
      const copyRegex = new RegExp(
        `^${quiz.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(copy (\\d+)\\)$`
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

      const duplicatedQuizData = await quizService.duplicatePresentation(quiz.id, newName);

      // Add the duplicated quiz to local state
      // Assuming the API returns the new quiz data, map it to our local format
      const now = Date.now();
      const newQuiz = {
        id: duplicatedQuizData.id,
        revision: Number(duplicatedQuizData.revision || 1),
        name: duplicatedQuizData.title,
        accessCode: duplicatedQuizData.access_code || "",
        slides: duplicatedQuizData.slides?.length ?? quiz.slides,
        participants: 0,
        members: "",
        createdBy: quiz.createdBy,
        lastUpdated: formatDate(now),
        created: formatDate(now),
        updatedAt: now,
        createdAt: now,
      };

      setQuizzes([...quizzes, newQuiz]);
      setStatusMessage({
        type: "success",
        message: "Quiz duplicated successfully.",
      });
    } catch (err) {
      console.error("Error duplicating quiz:", err);
      setError(err.message);
    } finally {
      setShowMenu(null);
    }
  };

  // Handle present click
  const handlePresent = async (quizId) => {
    try {
      const quiz = await quizService.getQuiz(quizId);

      if (!quiz.slides || quiz.slides.length === 0) {
        setErrorForModal("Quiz has no slides.");
        setErrorModalOpen(true);
        return;
      }

      const validationError = getPresentationValidationError(quiz);
      if (validationError) {
        setErrorForModal(validationError);
        setErrorModalOpen(true);
        return;
      }

      navigate(`/manager/presentation/${quizId}/`);
    } catch {
      setErrorForModal("Failed to load quiz.");
      setErrorModalOpen(true);
    }
  };
  // Handle edit click
  const handleEdit = (quizId) => {
    navigate(`/manager/panel/${quizId}/`);
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

  const dismissPasswordPrompt = () => {
    localStorage.removeItem("auth.promptSetPassword");
    setPasswordPromptVisible(false);
  };

  const sendPasswordSetupEmail = async () => {
    const email = localStorage.getItem("auth.email");
    if (!email) {
      setPasswordPromptStatus({
        type: "error",
        message: "Email address not found. Please log in again.",
      });
      return;
    }
    setPasswordPromptLoading(true);
    setPasswordPromptStatus(null);
    try {
      const response = await apiFetch("/auth/password/reset", {
        method: "POST",
        auth: false,
        json: { email },
      });
      if (!response.ok) {
        throw new Error(
          response.status === 503
            ? "Password recovery email delivery is not configured yet."
            : "Unable to send password setup email."
        );
      }
      setPasswordPromptStatus({
        type: "success",
        message: "Password setup link sent. Check your inbox.",
      });
      dismissPasswordPrompt();
    } catch (err) {
      setPasswordPromptStatus({
        type: "error",
        message: err.message || "Unable to send password setup email.",
      });
    } finally {
      setPasswordPromptLoading(false);
    }
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
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#faf9ff_0%,#f5f7fb_100%)] pb-24 text-slate-900 md:pb-28"
      dir="rtl"
      style={{ fontFamily: '"Vazirmatn", "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="min-h-screen mx-auto mb-8">
        {/* Top Navigation Bar with Search */}
        <div className="fixed inset-x-0 top-0 z-50 w-full border-b border-violet-100/80 bg-white/95 shadow-sm backdrop-blur">
          {/* Mobile Header */}
          <div className="md:hidden">
            {/* Single Row: Logo + Icons */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-lg font-bold text-violet-950 before:text-xl before:text-violet-600 before:content-['✱']" dir="ltr">
                ProSlides
              </div>
              <div className="flex items-center gap-1">
                {/* Search Icon */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMobileSearch(!showMobileSearch);
                  }}
                  className={`p-1.5 rounded-lg transition ${
                    showMobileSearch
                      ? "bg-purple-100 text-purple-600"
                      : "hover:bg-gray-100 text-gray-600"
                  }`}
                  aria-label="نمایش جست‌وجو"
                  title="جست‌وجو"
                >
                  <Search className="w-5 h-5" />
                </button>
                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-violet-700 text-sm font-semibold text-white transition hover:bg-violet-800"
                    aria-label="باز کردن منوی حساب"
                  >
                    {loggedInUser.charAt(0).toUpperCase()}
                  </button>
                  {showProfileMenu && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg">
                      <button
                        onClick={() => handleLogout()}
                        className="flex w-full items-center gap-3 px-4 py-3 text-right text-gray-700 hover:bg-gray-50"
                      >
                        <LogOut className="w-4 h-4" />
                        خروج از حساب
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Mobile Search Bar - Expandable */}
            {showMobileSearch && (
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 animate-in slide-in-from-top duration-200">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="جست‌وجوی ارائه‌ها"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full rounded-xl border border-gray-200 bg-white py-2 pe-10 ps-10 text-sm text-gray-700 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="پاک کردن جست‌وجو"
                        title="پاک کردن جست‌وجو"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* Desktop Header */}
          <div className="hidden md:flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-1.5 text-lg font-bold text-violet-950 before:text-xl before:text-violet-600 before:content-['✱']" dir="ltr">
              ProSlides
            </div>

            <div className="relative flex-1 max-w-md mx-8">
              <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="جست‌وجوی ارائه‌ها"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pe-12 ps-4 text-gray-700 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

            <div className="flex items-center gap-4">
              {/* Profile Dropdown */}
              <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-violet-700 font-semibold text-white transition hover:bg-violet-800"
                    aria-label="باز کردن منوی حساب"
                    title="حساب کاربری"
                  >
                  {loggedInUser.charAt(0).toUpperCase()}
                </button>

                {showProfileMenu && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg">
                    <button
                      onClick={() => handleLogout()}
                      className="flex w-full items-center gap-3 px-4 py-3 text-right text-gray-700 hover:bg-gray-50"
                    >
                      <LogOut className="w-4 h-4" />
                      خروج از حساب
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content with top padding to account for fixed header */}
        <main className="mx-auto max-w-[1500px] px-4 pt-20 md:px-8 md:pt-24">
          {passwordPromptVisible && (
            <div className="mb-6 rounded-xl border border-purple-200 bg-white px-4 py-3 text-sm text-purple-900 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    برای حساب خود رمز عبور تعیین کنید
                  </div>
                  <div className="text-xs text-purple-700">
                    با گوگل ثبت‌نام کرده‌اید. با تعیین رمز عبور، بدون گوگل هم وارد شوید.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={sendPasswordSetupEmail}
                    disabled={passwordPromptLoading}
                    className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {passwordPromptLoading ? "در حال ارسال…" : "ارسال لینک"}
                  </button>
                  <button
                    onClick={dismissPasswordPrompt}
                    className="rounded-md border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                  >
                    بعداً
                  </button>
                </div>
              </div>
              {passwordPromptStatus && (
                <div
                  className={`mt-2 text-xs ${
                    passwordPromptStatus.type === "error"
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {passwordPromptStatus.message}
                </div>
              )}
            </div>
          )}
          {statusMessage && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm shadow-sm ${
                statusMessage.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
              role="status"
            >
              {statusMessage.message}
            </div>
          )}

          {/* My Presentations Section */}
          <div className="mb-6">
            {/* <h3 className="text-xs uppercase text-gray-500 mb-2">
              MY PRESENTATIONS
            </h3> */}
            <div className="mb-7 max-w-2xl">
              <p className="mb-2 text-sm font-semibold text-violet-700">فضای کاری شما</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                ارائه‌های من
              </h1>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                ارائه تازه بسازید، اسلایدها را ویرایش کنید و برای اجرای زنده آماده شوید.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 md:gap-0">
              <div className="flex gap-3 w-full md:w-auto">
                <Button
                  onClick={handleNewPresentation}
                  disabled={creatingQuiz}
                  aria-describedby={creationError ? "presentation-creation-error" : undefined}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-6 text-white shadow-lg shadow-violet-200 transition hover:bg-violet-800 focus-visible:ring-violet-500 md:w-auto"
                >
                  {creatingQuiz ? (
                    <>
                      <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      در حال ساخت…
                    </>
                  ) : (
                    <>
                      <Plus className="h-5 w-5" aria-hidden="true" />
                      ارائه جدید
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

              <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-3">
                <span className="text-sm text-gray-500">مرتب‌سازی</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="مرتب‌سازی ارائه‌ها"
                    className="cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pe-4 ps-10 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="Recently updated">آخرین ویرایش</option>
                    <option value="Name">نام</option>
                    <option value="Created date">تاریخ ساخت</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                </div>
              </div>
            </div>

            {creatingQuiz && (
              <p className="sr-only" role="status" aria-live="polite">
                در حال ساخت ارائه و انتقال به ویرایشگر
              </p>
            )}
            {creationError && (
              <div
                id="presentation-creation-error"
                className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                role="alert"
              >
                <span>{creationError}</span>
                <button
                  type="button"
                  onClick={handleNewPresentation}
                  disabled={creatingQuiz}
                  className="rounded-lg bg-white px-3 py-2 font-bold text-rose-700 shadow-sm ring-1 ring-rose-200 hover:bg-rose-100"
                >
                  تلاش دوباره
                </button>
              </div>
            )}

            {showEmptyState && (
              <div className="mb-6 rounded-3xl border border-dashed border-violet-200 bg-white px-6 py-14 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Plus className="h-7 w-7" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {searchQuery ? "نتیجه‌ای پیدا نشد" : "اولین ارائه‌تان را بسازید"}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {searchQuery
                    ? "عبارت دیگری را امتحان کنید یا جست‌وجو را پاک کنید."
                    : "از یک ارائه خالی شروع کنید و اولین اسلاید را در ویرایشگر بسازید."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {searchQuery ? (
                    <Button
                      variant="outline"
                      onClick={() => setSearchQuery("")}
                      className="border-gray-300 bg-white text-gray-700"
                    >
                      پاک کردن جست‌وجو
                    </Button>
                  ) : null}
                  <Button
                    onClick={handleNewPresentation}
                    disabled={creatingQuiz}
                    className="rounded-xl bg-violet-700 px-6 py-2.5 text-white hover:bg-violet-800"
                  >
                    {creatingQuiz ? "در حال ساخت…" : "ساخت اولین ارائه"}
                  </Button>
                </div>
              </div>
            )}

            {/* Quiz Table */}
            {!showEmptyState && (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
                  <table className="w-full">
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
                      نام
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      کد ورود
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      سازنده
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      آخرین ویرایش
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-600">
                      تاریخ ساخت
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
                              <span
                                className="relative inline-flex items-center gap-1 group/tooltip"
                                aria-label={`Slides: ${quiz.slides}`}
                              >
                                <span aria-hidden="true">📄</span>
                                {quiz.slides}
                                <span
                                  role="tooltip"
                                  className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition duration-150 group-hover/tooltip:opacity-100"
                                >
                                  Slides count
                                </span>
                              </span>
                              <span
                                className="relative inline-flex items-center gap-1 group/tooltip"
                                aria-label={`Participants: ${quiz.participants}`}
                              >
                                <span aria-hidden="true">👥</span>
                                {quiz.participants}
                                <span
                                  role="tooltip"
                                  className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition duration-150 group-hover/tooltip:opacity-100"
                                >
                                  Participants count
                                </span>
                              </span>
                              <span className="text-gray-400">
                                {quiz.members}
                              </span>
                              <button
                                onClick={() =>
                                  navigate(`/manager/panel/${quiz.id}/report`)
                                }
                                className="mt-2 mb-1 inline-flex items-center bg-purple-100 hover:bg-purple-600 text-[#6D28D9] hover:text-white px-2 py-1 rounded text-xs font-medium transition-colors"
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
                                گزارش
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
                            className="bg-blue-800 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                          >
                            ویرایش
                          </Button>
                          <Button
                            onClick={() => handlePresent(quiz.id)}
                            className="bg-purple-800 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm"
                          >
                            اجرا
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
                                  onClick={() => handlePresent(quiz.id)}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-purple-600 font-medium"
                                >
                                  <Play className="w-4 h-4" />
                                  اجرا
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
                                  پاک‌کردن نتایج
                                </button>
                                <button
                                  onClick={() => handleDuplicate(quiz)}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <Copy className="w-4 h-4" />
                                  تکثیر
                                </button>
                                <button
                                  onClick={() => {
                                    setShowShareModal(quiz.id);
                                    setShowMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <span className="w-4 h-4 pb-5">🔗</span>
                                  اشتراک‌گذاری
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

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
              {filteredQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className={`bg-white rounded-lg p-5 shadow-sm border border-gray-200 relative transition-all ${
                    selectedQuizzes.includes(quiz.id)
                      ? "ring-2 ring-purple-500 bg-purple-50/30"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      <input
                        type="checkbox"
                        className="rounded w-5 h-5 border-gray-300 text-purple-600 focus:ring-purple-500"
                        checked={selectedQuizzes.includes(quiz.id)}
                        onChange={() => handleQuizSelect(quiz.id)}
                      />
                      <div className="w-12 h-12 min-w-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xl shadow-sm">
                        🎯
                      </div>
                      <div className="truncate min-w-0 flex-1">
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
                                if (!success) setNewQuizName(quiz.name);
                              }
                              setRenamingQuiz(null);
                            }}
                            autoFocus
                            className="w-full font-semibold text-gray-800 border border-purple-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-200"
                          />
                        ) : (
                          <h3
                            className="font-semibold text-gray-900 truncate text-lg leading-tight"
                            onClick={() => handleEdit(quiz.id)}
                          >
                            {quiz.name}
                          </h3>
                        )}
                        <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                          <span
                            className="relative inline-flex items-center gap-1 group/tooltip"
                            aria-label={`Slides: ${quiz.slides}`}
                          >
                            <span aria-hidden="true">📄</span>
                            {quiz.slides}
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition duration-150 group-hover/tooltip:opacity-100"
                            >
                              Slides count
                            </span>
                          </span>
                          <span
                            className="relative inline-flex items-center gap-1 group/tooltip"
                            aria-label={`Participants: ${quiz.participants}`}
                          >
                            <span aria-hidden="true">👥</span>
                            {quiz.participants}
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition duration-150 group-hover/tooltip:opacity-100"
                            >
                              Participants count
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(showMenu === quiz.id ? null : quiz.id);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                      </button>

                      {showMenu === quiz.id && (
                        <div className="absolute right-0 top-10 bg-white border border-gray-100 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] w-56 z-50 overflow-hidden flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right text-sm">
                          <button
                            onClick={() => {
                              handlePresent(quiz.id);
                              setShowMenu(null);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-purple-600 font-medium"
                          >
                            <Play className="w-4 h-4" /> اجرا
                          </button>
                          <button
                            onClick={() => {
                              setRenamingQuiz(quiz.id);
                              setNewQuizName(quiz.name);
                              setShowMenu(null);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                          >
                            <Pencil className="w-4 h-4" /> تغییر نام
                          </button>
                          <button
                            onClick={() => {
                              setShowShareModal(quiz.id);
                              setShowMenu(null);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                          >
                            <span className="w-4 h-4 flex items-center justify-center">
                              🔗
                            </span>{" "}
                            اشتراک‌گذاری
                          </button>
                          <button
                            onClick={() => handleDuplicate(quiz)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                          >
                            <Copy className="w-4 h-4" /> تکثیر
                          </button>
                          <div className="h-px bg-gray-100 my-1"></div>
                          <button
                            onClick={() => {
                              setShowMenu(null);
                              showConfirmDialog({
                                title: "Reset Quiz Results",
                                description:
                                  "Are you sure you want to reset all results for this quiz? This action cannot be undone.",
                                confirmText: "Reset Results",
                                confirmVariant: "destructive",
                                onConfirm: async () =>
                                  await resetQuizResults(quiz.id),
                              });
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                          >
                            <Copy className="w-4 h-4" /> پاک‌کردن نتایج
                          </button>
                          <button
                            onClick={() => {
                              setShowMenu(null);
                              handleDeleteQuiz(quiz.id);
                            }}
                            className="w-full text-left px-4 py-3 text-red-500 hover:bg-red-50 flex items-center gap-3"
                          >
                            <Trash2 className="w-4 h-4" /> حذف
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-5 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block mb-1">
                        کد ورود
                      </span>
                      <div
                        onClick={() => setShowShareModal(quiz.id)}
                        className="font-mono font-bold text-purple-600 bg-purple-100/50 px-2 py-1 rounded inline-block cursor-pointer border border-purple-100"
                      >
                        {quiz.accessCode}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium block mb-1">
                        آخرین ویرایش
                      </span>
                      <span className="text-xs font-medium text-gray-600">
                        {quiz.lastUpdated}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      onClick={() => navigate(`/manager/panel/${quiz.id}/report`)}
                      variant="outline"
                      className="flex-1 h-10 text-sm border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium tracking-wide"
                    >
                      گزارش
                    </Button>
                    <Button
                      onClick={() => handleEdit(quiz.id)}
                      variant="outline"
                      className="flex-1 h-10 text-sm border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium tracking-wide"
                    >
                      ویرایش
                    </Button>
                    <Button
                      onClick={() => handlePresent(quiz.id)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-10 text-sm shadow-sm shadow-purple-200 font-medium tracking-wide"
                    >
                      اجرا
                    </Button>
                  </div>
                </div>
              ))}
                </div>
              </>
            )}
            {loading && (
              <div className="grid gap-4 py-4 md:grid-cols-2 xl:grid-cols-3" aria-label="در حال بارگذاری ارائه‌ها" aria-busy="true">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-44 animate-pulse rounded-2xl border border-violet-100 bg-white motion-reduce:animate-none" />
                ))}
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
                بارگذاری ارائه‌ها انجام نشد. لطفاً صفحه را دوباره بارگذاری کنید.
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareMenu
          isOpen={true}
          onClose={() => setShowShareModal(null)}
          quizId={showShareModal}
          accessCode={quizzes.find((q) => q.id === showShareModal)?.accessCode}
          onAccessCodeSaved={(updatedCode) => {
            setQuizzes((prevQuizzes) =>
              prevQuizzes.map((quiz) =>
                quiz.id === showShareModal
                  ? { ...quiz, accessCode: updatedCode }
                  : quiz
              )
            );
          }}
        />
      )}

      {/* Bottom Action Bar */}
      {selectedQuizzes.length > 0 && (
        <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 mb-8 z-50">
          <div className="bg-[#4A5568] text-white rounded-lg shadow-2xl px-6 py-4 flex items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedQuizzes.length} انتخاب‌شده
              </span>
              {!allSelected && (
                <button
                  onClick={handleBottomBarSelectAll}
                  className="text-sm hover:text-gray-300 transition flex items-center gap-2"
                >
                  <span className="text-lg">⚡</span>
                  انتخاب همه
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
                حذف ارائه‌ها
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
      {(showMenu || showProfileMenu || showMobileSearch) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowMenu(null);
            setShowProfileMenu(false);
            setShowMobileSearch(false);
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

      <ErrorModal
        isOpen={errorModalOpen}
        onClose={closeErrorModal}
        message={errorForModal}
      />
    </div>
  );
}
