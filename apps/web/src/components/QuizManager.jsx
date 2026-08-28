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
  LogOut,
  X,
  LoaderCircle,
  Plus,
} from "lucide-react";
import ShareMenu from "./ShareMenu";
import { apiFetch } from "../utils/apiFetch";
import { clearAuthStorage } from "../utils/auth";
import { getPresentationValidationError } from "../pages/quiz/manager/questionValidation";
import { createPresentationOnce } from "../modules/presentations/model/createPresentationFlow.ts";
import Notice from "../shared/ui/Notice";

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

const formatNumber = (value) =>
  new Intl.NumberFormat("fa-IR").format(Number(value) || 0);

const normalizePersianText = (value = "") =>
  String(value)
    .normalize("NFKC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[‌\s]+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");

const persianCollator = new Intl.Collator("fa-IR", {
  numeric: true,
  sensitivity: "base",
});

const localizeSystemTitle = (title) => {
  const value = String(title || "").trim();
  if (!value) return "ارائه بدون عنوان";
  if (value === "Untitled Presentation") return "ارائه بدون عنوان";

  const untitledCopyMatch = value.match(/^Untitled Presentation \(copy (\d+)\)$/i);
  if (untitledCopyMatch) {
    return `ارائه بدون عنوان - نسخه ${Number(untitledCopyMatch[1]) + 1}`;
  }

  return value;
};

const getDuplicateTitle = (quiz, allQuizzes) => {
  const versionPattern = /\s*-\s*نسخه\s+(\d+)$/;
  const baseName = quiz.name.replace(versionPattern, "").trim() || "ارائه بدون عنوان";
  let maxVersion = 1;

  allQuizzes.forEach((item) => {
    if (item.name === baseName) {
      maxVersion = Math.max(maxVersion, 1);
      return;
    }
    const match = item.name.match(versionPattern);
    if (match && item.name.replace(versionPattern, "").trim() === baseName) {
      maxVersion = Math.max(maxVersion, Number(match[1]) || 1);
    }
  });

  return `${baseName} - نسخه ${maxVersion + 1}`;
};

export default function QuizManager({ onNewPresentation }) {
  const navigate = useNavigate();
  const [loggedInUser] = useState(
    () => localStorage.getItem("auth.name") || "شما"
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
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

  const fetchQuizzes = useCallback(async (signal, { silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const data = await quizService.listPresentations({ signal });

      const mappedQuizzes = (Array.isArray(data) ? data : []).map((quiz) => {
        const updatedAt = safeTimestamp(quiz.updated_at);
        const createdAt = safeTimestamp(quiz.created_at);
        return {
          id: quiz.id,
          revision: Number(quiz.revision || 1),
          name: localizeSystemTitle(quiz.title),
          accessCode: quiz.access_code || "",
          slides: Number(quiz.slide_count) || 0,
          participants: Number(quiz.participant_count) || 0,
          members: "",
          createdBy: quiz.owner_full_name || quiz.owner_name || loggedInUser,
          lastUpdated: formatDate(updatedAt),
          created: formatDate(createdAt),
          updatedAt,
          createdAt,
        };
      });

      setQuizzes(mappedQuizzes);
      setSelectedQuizzes((prev) => {
        const validIds = new Set(mappedQuizzes.map((quiz) => quiz.id));
        return prev.filter((id) => validIds.has(id));
      });
      if (!silent) setLoadError(null);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Error fetching presentations:", err);
      if (silent) {
        setStatusMessage({
          type: "error",
          message: "به‌روزرسانی فهرست ارائه‌ها انجام نشد.",
        });
      } else {
        setLoadError("بارگذاری ارائه‌ها انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید.");
      }
    } finally {
      if (!silent) setLoading(false);
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
  const [sortBy, setSortBy] = useState("updated");
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
    confirmText: "تأیید",
    cancelText: "انصراف",
    confirmVariant: "default",
    isLoading: false,
    onConfirm: null,
    onClose: null,
  });
  const activeMenuButtonRef = useRef(null);
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [creationError, setCreationError] = useState(null);
  const [duplicatingQuizIds, setDuplicatingQuizIds] = useState([]);
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
      title: config.title || "تأیید عملیات",
      description: config.description || "",
      confirmText: config.confirmText || "تأیید",
      cancelText: config.cancelText || "انصراف",
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

  const normalizedSearchQuery = normalizePersianText(searchQuery);
  const filteredQuizzes = quizzes
    .filter((quiz) =>
      normalizePersianText(quiz.name).includes(normalizedSearchQuery)
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "updated":
          return b.updatedAt - a.updatedAt;
        case "name":
          return persianCollator.compare(a.name, b.name);
        case "created":
          return b.createdAt - a.createdAt;
        default:
          return 0;
      }
    });

  const selectedInFilterCount = filteredQuizzes.filter((quiz) =>
    selectedQuizzes.includes(quiz.id)
  ).length;

  const allSelected =
    filteredQuizzes.length > 0 &&
    selectedInFilterCount === filteredQuizzes.length;
  const someSelected = selectedInFilterCount > 0 && !allSelected;
  const showEmptyState =
    !loading && !loadError && filteredQuizzes.length === 0;

  const handleSelectAll = () => {
    const filteredIds = new Set(filteredQuizzes.map((quiz) => quiz.id));
    setSelectedQuizzes((prev) => {
      if (allSelected) {
        return prev.filter((id) => !filteredIds.has(id));
      }
      return Array.from(new Set([...prev, ...filteredIds]));
    });
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

  // Delete a single presentation via API
  const deleteQuiz = async (quizId, manageLoadingState = true) => {
    try {
      if (manageLoadingState) {
        setDeletingQuizIds((prev) => [...new Set([...prev, quizId])]);
      }

      await quizService.deletePresentation(quizId);
      setQuizzes((prev) => prev.filter((quiz) => quiz.id !== quizId));
      setSelectedQuizzes((prev) => prev.filter((id) => id !== quizId));
      return true;
    } catch (err) {
      console.error("Error deleting presentation:", err);
      return false;
    } finally {
      if (manageLoadingState) {
        setDeletingQuizIds((prev) => prev.filter((id) => id !== quizId));
      }
    }
  };

  const renameQuiz = async (quizId, newName) => {
    const trimmedName = newName.trim();
    if (!trimmedName) return false;

    try {
      const currentQuiz = quizzes.find((quiz) => quiz.id === quizId);
      const updated = await quizService.updateQuiz(quizId, {
        title: trimmedName,
        revision: currentQuiz?.revision,
      });

      const updatedAt = safeTimestamp(updated.updated_at) || Date.now();
      setQuizzes((prev) =>
        prev.map((quiz) =>
          quiz.id === quizId
            ? {
                ...quiz,
                name: trimmedName,
                revision: Number(updated.revision || quiz.revision),
                updatedAt,
                lastUpdated: formatDate(updatedAt),
              }
            : quiz
        )
      );
      setStatusMessage({ type: "success", message: "نام ارائه تغییر کرد." });
      return true;
    } catch (err) {
      console.error("Error renaming presentation:", err);
      if (err.response?.status === 409 && err.response?.data?.error === "edit_conflict") {
        await fetchQuizzes(undefined, { silent: true });
        setStatusMessage({
          type: "error",
          message: "این ارائه در جای دیگری تغییر کرده بود؛ آخرین نسخه بارگذاری شد.",
        });
      } else {
        setStatusMessage({
          type: "error",
          message: "تغییر نام ارائه انجام نشد. دوباره تلاش کنید.",
        });
      }
      return false;
    }
  };

  const resetQuizResults = async (quizId) => {
    try {
      const quiz = quizzes.find((item) => item.id === quizId);
      if (!quiz) throw new Error("presentation_not_found");

      await quizService.resetPresentationResults(quizId);
      setQuizzes((prev) =>
        prev.map((item) =>
          item.id === quizId ? { ...item, participants: 0 } : item
        )
      );
      setStatusMessage({
        type: "success",
        message: "نتایج ارائه با موفقیت پاک شد.",
      });
      return true;
    } catch (err) {
      console.error("Error resetting presentation results:", err);
      setStatusMessage({
        type: "error",
        message: "پاک‌کردن نتایج انجام نشد. دوباره تلاش کنید.",
      });
      return false;
    }
  };

  const handleMoveToTrash = async () => {
    if (selectedQuizzes.length === 0) return;

    const selectedCount = selectedQuizzes.length;
    showConfirmDialog({
      title: "حذف ارائه‌ها",
      description: `آیا از حذف ${formatNumber(selectedCount)} ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.`,
      confirmText: "حذف",
      cancelText: "انصراف",
      confirmVariant: "destructive",
      onConfirm: async () => {
        const idsToDelete = [...selectedQuizzes];
        setDeletingQuizIds(idsToDelete);
        try {
          const results = await Promise.all(idsToDelete.map((id) => deleteQuiz(id, false)));
          const failedCount = results.filter((result) => !result).length;
          await fetchQuizzes(undefined, { silent: true });

          if (failedCount === 0) {
            setSelectedQuizzes([]);
            setStatusMessage({
              type: "success",
              message: `${formatNumber(selectedCount)} ارائه حذف شد.`,
            });
          } else {
            setStatusMessage({
              type: "error",
              message: `حذف ${formatNumber(failedCount)} ارائه انجام نشد.`,
            });
          }
        } finally {
          setDeletingQuizIds([]);
        }
      },
    });
  };

  const handleDeleteQuiz = async (quizId) => {
    setShowMenu(null);
    showConfirmDialog({
      title: "حذف ارائه",
      description: "آیا از حذف این ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.",
      confirmText: "حذف",
      cancelText: "انصراف",
      confirmVariant: "destructive",
      onConfirm: async () => {
        setShowMenu(null);
        const success = await deleteQuiz(quizId);
        setStatusMessage(
          success
            ? { type: "success", message: "ارائه حذف شد." }
            : { type: "error", message: "حذف ارائه انجام نشد. دوباره تلاش کنید." }
        );
      },
    });
  };

  const handleBottomBarSelectAll = () => {
    const filteredIds = filteredQuizzes.map((quiz) => quiz.id);
    setSelectedQuizzes((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const handleDuplicate = async (quiz) => {
    if (duplicatingQuizIds.includes(quiz.id)) return;

    try {
      setDuplicatingQuizIds((prev) => [...new Set([...prev, quiz.id])]);
      const newName = getDuplicateTitle(quiz, quizzes);
      const duplicated = await quizService.duplicatePresentation(quiz.id, newName);
      const updatedAt = safeTimestamp(duplicated.updated_at) || Date.now();
      const createdAt = safeTimestamp(duplicated.created_at) || updatedAt;
      const newQuiz = {
        id: duplicated.id,
        revision: Number(duplicated.revision || 1),
        name: localizeSystemTitle(duplicated.title || newName),
        accessCode: duplicated.access_code || "",
        slides: Number(duplicated.slide_count ?? duplicated.slides?.length ?? quiz.slides) || 0,
        participants: 0,
        members: "",
        createdBy: duplicated.owner_full_name || duplicated.owner_name || quiz.createdBy,
        lastUpdated: formatDate(updatedAt),
        created: formatDate(createdAt),
        updatedAt,
        createdAt,
      };

      setQuizzes((prev) => [...prev, newQuiz]);
      setStatusMessage({ type: "success", message: "یک نسخه از ارائه ساخته شد." });
    } catch (err) {
      console.error("Error duplicating presentation:", err);
      setStatusMessage({
        type: "error",
        message: "تکثیر ارائه انجام نشد. دوباره تلاش کنید.",
      });
    } finally {
      setDuplicatingQuizIds((prev) => prev.filter((id) => id !== quiz.id));
      setShowMenu(null);
    }
  };

  // Handle present click
  const handlePresent = async (quizId) => {
    try {
      const quiz = await quizService.getQuiz(quizId);

      if (!quiz.slides || quiz.slides.length === 0) {
        setErrorForModal("این ارائه هنوز اسلایدی ندارد.");
        setErrorModalOpen(true);
        return;
      }

      const validationError = getPresentationValidationError(quiz);
      if (validationError) {
        setErrorForModal(validationError || "اطلاعات ارائه کامل نیست.");
        setErrorModalOpen(true);
        return;
      }

      navigate(`/manager/presentation/${quizId}/`);
    } catch {
      setErrorForModal("بارگذاری ارائه انجام نشد. دوباره تلاش کنید.");
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

  const postponePasswordPrompt = () => {
    setPasswordPromptVisible(false);
  };

  const clearPasswordPrompt = () => {
    localStorage.removeItem("auth.promptSetPassword");
    setPasswordPromptVisible(false);
  };

  const sendPasswordSetupEmail = async () => {
    const email = localStorage.getItem("auth.email");
    if (!email) {
      setPasswordPromptStatus({
        type: "error",
        message: "نشانی ایمیل پیدا نشد. لطفاً دوباره وارد حساب شوید.",
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
            ? "سامانه ارسال ایمیل در حال حاضر در دسترس نیست."
            : "ارسال لینک تعیین رمز عبور انجام نشد."
        );
      }
      clearPasswordPrompt();
      setStatusMessage({
        type: "success",
        message: "لینک تعیین رمز عبور ارسال شد. صندوق ورودی ایمیل خود را بررسی کنید.",
      });
    } catch (err) {
      setPasswordPromptStatus({
        type: "error",
        message: err.message || "ارسال لینک تعیین رمز عبور انجام نشد.",
      });
    } finally {
      setPasswordPromptLoading(false);
    }
  };

  const checkMenuPosition = (buttonElement) => {
    if (!buttonElement) return;

    const rect = buttonElement.getBoundingClientRect();
    const menuHeight = 320;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    setMenuPosition(spaceBelow >= menuHeight || spaceBelow >= spaceAbove ? "bottom" : "top");
  };

  const handleMenuToggle = (quizId, event) => {
    event.stopPropagation();

    if (showMenu === quizId) {
      setShowMenu(null);
      activeMenuButtonRef.current = null;
      return;
    }

    activeMenuButtonRef.current = event.currentTarget;
    setShowMenu(quizId);
    requestAnimationFrame(() => checkMenuPosition(activeMenuButtonRef.current));
  };

  useEffect(() => {
    if (!showMenu) return undefined;

    const handlePositionUpdate = () => checkMenuPosition(activeMenuButtonRef.current);
    window.addEventListener("scroll", handlePositionUpdate, true);
    window.addEventListener("resize", handlePositionUpdate);

    return () => {
      window.removeEventListener("scroll", handlePositionUpdate, true);
      window.removeEventListener("resize", handlePositionUpdate);
    };
  }, [showMenu]);

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-brand-soft to-canvas pb-24 text-content md:pb-28"
      dir="rtl"
      style={{ fontFamily: '"Vazirmatn", "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="min-h-screen mx-auto mb-8">
        {/* Top Navigation Bar with Search */}
        <div className="fixed inset-x-0 top-0 z-50 w-full border-b border-brand-border bg-surface/95 shadow-sm backdrop-blur">
          {/* Mobile Header */}
          <div className="md:hidden">
            {/* Single Row: Logo + Icons */}
            <div className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-1.5 font-brand text-lg font-bold text-brand-ink before:text-xl before:text-brand before:content-['✱']" dir="ltr">
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
                      ? "bg-brand-muted text-brand"
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
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-brand text-sm font-semibold text-content-inverse transition hover:bg-brand-strong"
                    aria-label="باز کردن منوی حساب"
                  >
                    {loggedInUser.charAt(0).toUpperCase()}
                  </button>
                  {showProfileMenu && (
                    <div className="absolute start-0 top-full z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg">
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
                  <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="جست‌وجوی ارائه‌ها"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full rounded-control border border-border-subtle bg-surface py-2 pe-10 ps-10 text-sm text-content transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            <div className="flex items-center gap-1.5 font-brand text-lg font-bold text-brand-ink before:text-xl before:text-brand before:content-['✱']" dir="ltr">
              ProSlides
            </div>

            <div className="relative flex-1 max-w-md mx-8">
              <Search className="pointer-events-none absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="جست‌وجوی ارائه‌ها"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-control border border-border-subtle bg-canvas py-2.5 pe-12 ps-4 text-content transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
              />
            </div>

            <div className="flex items-center gap-4">
              {/* Profile Dropdown */}
              <div className="relative">
                  <button
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-brand font-semibold text-content-inverse transition hover:bg-brand-strong"
                    aria-label="باز کردن منوی حساب"
                    title="حساب کاربری"
                  >
                  {loggedInUser.charAt(0).toUpperCase()}
                </button>

                {showProfileMenu && (
                  <div className="absolute start-0 top-full z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg">
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
            <div className="mb-6 rounded-control border border-brand-border bg-surface px-4 py-3 text-sm text-brand-ink shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    برای حساب خود رمز عبور تعیین کنید
                  </div>
                  <div className="text-xs text-brand-strong">
                    با گوگل ثبت‌نام کرده‌اید. با تعیین رمز عبور، بدون گوگل هم وارد شوید.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={sendPasswordSetupEmail}
                    disabled={passwordPromptLoading}
                    className="rounded-control bg-brand px-3 py-1.5 text-xs font-semibold text-content-inverse hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {passwordPromptLoading ? "در حال ارسال…" : "ارسال لینک"}
                  </button>
                  <button
                    onClick={postponePasswordPrompt}
                    className="rounded-control border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-strong hover:bg-brand-soft"
                  >
                    بعداً
                  </button>
                </div>
              </div>
              {passwordPromptStatus && (
                <Notice
                  tone={passwordPromptStatus.type === "error" ? "error" : "success"}
                  className="mt-2 text-xs"
                >
                  {passwordPromptStatus.message}
                </Notice>
              )}
            </div>
          )}
          {statusMessage && (
            <Notice
              tone={statusMessage.type === "error" ? "error" : "success"}
              className="mb-6"
            >
              {statusMessage.message}
            </Notice>
          )}

          {/* My Presentations Section */}
          <div className="mb-6">
            <div className="mb-7 max-w-2xl">
              <p className="mb-2 text-sm font-semibold text-brand">فضای کاری شما</p>
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
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand px-6 text-content-inverse shadow-lg transition hover:bg-brand-strong focus-visible:ring-focus md:w-auto"
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
              </div>

              <div className="flex items-center justify-between w-full md:w-auto md:justify-end gap-3">
                <span className="text-sm text-gray-500">مرتب‌سازی</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="مرتب‌سازی ارائه‌ها"
                    className="cursor-pointer appearance-none rounded-control border border-border-subtle bg-surface py-2.5 pe-4 ps-10 text-sm text-content focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    <option value="updated">آخرین ویرایش</option>
                    <option value="name">نام</option>
                    <option value="created">تاریخ ساخت</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                </div>
              </div>
            </div>

            {creatingQuiz && (
              <Notice pending className="sr-only">
                در حال ساخت ارائه و انتقال به ویرایشگر
              </Notice>
            )}
            {creationError && (
              <Notice
                id="presentation-creation-error"
                tone="error"
                className="mb-6 flex-wrap"
                action={<button
                  type="button"
                  onClick={handleNewPresentation}
                  disabled={creatingQuiz}
                  className="rounded-control bg-surface px-3 py-2 font-bold text-danger-ink shadow-sm ring-1 ring-danger-border hover:bg-danger-soft"
                >
                  تلاش دوباره
                </button>}
              >
                {creationError}
              </Notice>
            )}

            {showEmptyState && (
              <div className="mb-6 rounded-3xl border border-dashed border-brand-border bg-surface px-6 py-14 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-muted text-brand">
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
                    className="rounded-control bg-brand px-6 py-2.5 text-content-inverse hover:bg-brand-strong"
                  >
                    {creatingQuiz ? "در حال ساخت…" : "ساخت اولین ارائه"}
                  </Button>
                </div>
              </div>
            )}

            {/* Quiz Table */}
            {!loading && !loadError && !showEmptyState && (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-visible">
                  <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={handleSelectAll}
                        aria-label="انتخاب همه ارائه‌های نمایش‌داده‌شده"
                      />
                    </th>
                    <th className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      نام
                    </th>
                    <th className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      کد ورود
                    </th>
                    <th className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      سازنده
                    </th>
                    <th className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      آخرین ویرایش
                    </th>
                    <th className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      تاریخ ساخت
                    </th>
                    <th className="text-start px-6 py-3 text-sm font-medium text-gray-600"></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredQuizzes.map((quiz) => (
                    <tr
                      key={quiz.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition relative group ${
                        selectedQuizzes.includes(quiz.id) ? "bg-info-soft" : ""
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
                          aria-label={`انتخاب ارائه ${quiz.name}`}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-16 items-center justify-center rounded bg-gradient-to-br from-brand to-brand-strong text-2xl text-content-inverse">
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
                                  setRenamingQuiz((current) =>
                                    current === quiz.id ? null : current
                                  );
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.target.blur();
                                  } else if (e.key === "Escape") {
                                    setRenamingQuiz(null);
                                  }
                                }}
                                autoFocus
                                dir="auto"
                                className="rounded border border-brand px-2 py-1 font-semibold text-content focus:outline-none focus:ring-2 focus:ring-focus"
                              />
                            ) : (
                              <div className="font-semibold text-content" dir="auto">
                                {quiz.name}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <span
                                className="relative inline-flex items-center gap-1 group/tooltip"
                                aria-label={`تعداد اسلایدها: ${formatNumber(quiz.slides)}`}
                              >
                                <span aria-hidden="true">📄</span>
                                {formatNumber(quiz.slides)}
                                <span
                                  role="tooltip"
                                  className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition duration-150 group-hover/tooltip:opacity-100"
                                >
                                  تعداد اسلایدها
                                </span>
                              </span>
                              <span
                                className="relative inline-flex items-center gap-1 group/tooltip"
                                aria-label={`تعداد شرکت‌کنندگان: ${formatNumber(quiz.participants)}`}
                              >
                                <span aria-hidden="true">👥</span>
                                {formatNumber(quiz.participants)}
                                <span
                                  role="tooltip"
                                  className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition duration-150 group-hover/tooltip:opacity-100"
                                >
                                  تعداد شرکت‌کنندگان
                                </span>
                              </span>
                              <span className="text-gray-400">
                                {quiz.members}
                              </span>
                              <button
                                onClick={() =>
                                  navigate(`/manager/panel/${quiz.id}/report`)
                                }
                                className="mb-1 mt-2 inline-flex items-center rounded bg-brand-muted px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand hover:text-content-inverse"
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
                                    fill="currentColor"
                                    className="text-brand-border"
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
                          <button
                            type="button"
                            onClick={() => setShowShareModal(quiz.id)}
                            className="font-mono font-semibold text-brand transition hover:text-brand-strong"
                            dir="ltr"
                            aria-label={`مدیریت کد ورود ${quiz.accessCode || "بدون کد"}`}
                          >
                            {quiz.accessCode || "—"}
                          </button>
                          <button
                            onClick={() => setShowShareModal(quiz.id)}
                            className="p-1 hover:bg-gray-200 rounded transition opacity-0 group-hover/access:opacity-100 focus:opacity-100"
                            aria-label={`ویرایش یا اشتراک کد ورود ${quiz.name}`}
                          >
                            <Pencil className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                            {String(quiz.createdBy || "شما")
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((name) => name[0])
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
                            className="rounded-control bg-info px-4 py-2 text-sm text-content-inverse hover:brightness-90"
                          >
                            ویرایش
                          </Button>
                          <Button
                            onClick={() => handlePresent(quiz.id)}
                            className="rounded-control bg-brand-strong px-4 py-2 text-sm text-content-inverse hover:bg-brand"
                          >
                            اجرا
                          </Button>
                          <div className="relative">
                            <button
                              onClick={(e) => handleMenuToggle(quiz.id, e)}
                              className="p-2 hover:bg-gray-200 rounded transition"
                              aria-label={`باز کردن منوی عملیات ${quiz.name}`}
                              aria-expanded={showMenu === quiz.id}
                            >
                              <MoreVertical className="w-5 h-5 text-gray-600" />
                            </button>
                            {showMenu === quiz.id && (
                              <div
                                className={`absolute end-0 ${
                                  menuPosition === "top"
                                    ? "bottom-full mb-2"
                                    : "top-full mt-2"
                                } bg-white border border-gray-200 rounded-lg shadow-lg w-48 z-[60] max-h-[80vh] overflow-y-auto`}
                              >
                                <button
                                  onClick={() => {
                                    setShowMenu(null);
                                    handlePresent(quiz.id);
                                  }}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-start font-medium text-brand hover:bg-brand-soft"
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
                                  className="w-full text-start px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <Pencil className="w-4 h-4" />
                                  تغییر نام
                                </button>
                                <button
                                  onClick={() => {
                                    setShowMenu(null);
                                    showConfirmDialog({
                                      title: "پاک‌کردن نتایج ارائه",
                                      description:
                                        "آیا از پاک‌کردن همه نتایج این ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.",
                                      confirmText: "پاک‌کردن نتایج",
                                      confirmVariant: "destructive",
                                      onConfirm: async () => {
                                        await resetQuizResults(quiz.id);
                                        setShowMenu(null);
                                      },
                                    });
                                  }}
                                  className="w-full text-start px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <Copy className="w-4 h-4" />
                                  پاک‌کردن نتایج
                                </button>
                                <button
                                  onClick={() => handleDuplicate(quiz)}
                                  disabled={duplicatingQuizIds.includes(quiz.id)}
                                  className="w-full text-start px-4 py-3 hover:bg-gray-50 flex items-center gap-3 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {duplicatingQuizIds.includes(quiz.id) ? (
                                    <LoaderCircle className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                  {duplicatingQuizIds.includes(quiz.id) ? "در حال تکثیر…" : "تکثیر"}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowShareModal(quiz.id);
                                    setShowMenu(null);
                                  }}
                                  className="w-full text-start px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                                >
                                  <span className="w-4 h-4 pb-5">🔗</span>
                                  اشتراک‌گذاری
                                </button>
                                <button
                                  onClick={() => handleDeleteQuiz(quiz.id)}
                                  className="flex w-full items-center gap-3 border-t border-border-subtle px-4 py-3 text-start text-danger hover:bg-danger-soft"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  حذف
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
                      ? "bg-brand-soft ring-2 ring-brand"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-border-subtle text-brand focus:ring-focus"
                        checked={selectedQuizzes.includes(quiz.id)}
                        onChange={() => handleQuizSelect(quiz.id)}
                        aria-label={`انتخاب ارائه ${quiz.name}`}
                      />
                      <div className="flex h-12 min-w-12 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-strong text-xl text-content-inverse shadow-sm">
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
                              setRenamingQuiz((current) =>
                                current === quiz.id ? null : current
                              );
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") event.currentTarget.blur();
                              if (event.key === "Escape") {
                                setNewQuizName(quiz.name);
                                setRenamingQuiz(null);
                              }
                            }}
                            autoFocus
                            dir="auto"
                            className="w-full rounded border border-brand px-2 py-1 font-semibold text-content focus:outline-none focus:ring-2 focus:ring-focus"
                          />
                        ) : (
                          <button
                            type="button"
                            className="block w-full truncate text-start text-lg font-semibold leading-tight text-content hover:text-brand-strong"
                            onClick={() => handleEdit(quiz.id)}
                            dir="auto"
                          >
                            {quiz.name}
                          </button>
                        )}
                        <div className="text-xs text-gray-500 flex items-center gap-3 mt-1">
                          <span
                            className="relative inline-flex items-center gap-1 group/tooltip"
                            aria-label={`تعداد اسلایدها: ${formatNumber(quiz.slides)}`}
                          >
                            <span aria-hidden="true">📄</span>
                            {formatNumber(quiz.slides)}
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition duration-150 group-hover/tooltip:opacity-100"
                            >
                              تعداد اسلایدها
                            </span>
                          </span>
                          <span
                            className="relative inline-flex items-center gap-1 group/tooltip"
                            aria-label={`تعداد شرکت‌کنندگان: ${formatNumber(quiz.participants)}`}
                          >
                            <span aria-hidden="true">👥</span>
                            {formatNumber(quiz.participants)}
                            <span
                              role="tooltip"
                              className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition duration-150 group-hover/tooltip:opacity-100"
                            >
                              تعداد شرکت‌کنندگان
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative ml-2">
                      <button
                        onClick={(e) => handleMenuToggle(quiz.id, e)}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label={`باز کردن منوی عملیات ${quiz.name}`}
                        aria-expanded={showMenu === quiz.id}
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" />
                      </button>

                      {showMenu === quiz.id && (
                        <div className={`absolute end-0 ${menuPosition === "top" ? "bottom-10" : "top-10"} max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-gray-100 bg-white py-1 text-sm shadow-[0_4px_20px_rgba(0,0,0,0.1)] z-50 animate-in fade-in zoom-in-95 duration-100`}>
                          <button
                            onClick={() => {
                              handlePresent(quiz.id);
                              setShowMenu(null);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-start font-medium text-brand hover:bg-brand-soft"
                          >
                            <Play className="w-4 h-4" /> اجرا
                          </button>
                          <button
                            onClick={() => {
                              setRenamingQuiz(quiz.id);
                              setNewQuizName(quiz.name);
                              setShowMenu(null);
                            }}
                            className="w-full text-start px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                          >
                            <Pencil className="w-4 h-4" /> تغییر نام
                          </button>
                          <button
                            onClick={() => {
                              setShowShareModal(quiz.id);
                              setShowMenu(null);
                            }}
                            className="w-full text-start px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                          >
                            <span className="w-4 h-4 flex items-center justify-center">
                              🔗
                            </span>{" "}
                            اشتراک‌گذاری
                          </button>
                          <button
                            onClick={() => handleDuplicate(quiz)}
                            disabled={duplicatingQuizIds.includes(quiz.id)}
                            className="w-full text-start px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {duplicatingQuizIds.includes(quiz.id) ? (
                              <LoaderCircle className="w-4 h-4 animate-spin" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                            {duplicatingQuizIds.includes(quiz.id) ? "در حال تکثیر…" : "تکثیر"}
                          </button>
                          <div className="h-px bg-gray-100 my-1"></div>
                          <button
                            onClick={() => {
                              setShowMenu(null);
                              showConfirmDialog({
                                title: "پاک‌کردن نتایج ارائه",
                                description:
                                  "آیا از پاک‌کردن همه نتایج این ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.",
                                confirmText: "پاک‌کردن نتایج",
                                confirmVariant: "destructive",
                                onConfirm: async () =>
                                  await resetQuizResults(quiz.id),
                              });
                            }}
                            className="w-full text-start px-4 py-3 hover:bg-gray-50 flex items-center gap-3 text-gray-700"
                          >
                            <Copy className="w-4 h-4" /> پاک‌کردن نتایج
                          </button>
                          <button
                            onClick={() => {
                              setShowMenu(null);
                              handleDeleteQuiz(quiz.id);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3 text-start text-danger hover:bg-danger-soft"
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
                      <button
                        type="button"
                        onClick={() => setShowShareModal(quiz.id)}
                        className="inline-block rounded border border-brand-border bg-brand-soft px-2 py-1 font-mono font-bold text-brand"
                        dir="ltr"
                        aria-label={`مدیریت کد ورود ${quiz.accessCode || "بدون کد"}`}
                      >
                        {quiz.accessCode || "—"}
                      </button>
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
                      className="h-10 flex-1 bg-brand text-sm font-medium tracking-wide text-content-inverse shadow-sm hover:bg-brand-strong"
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
                  <div key={item} className="h-44 animate-pulse rounded-2xl border border-brand-border bg-surface motion-reduce:animate-none" />
                ))}
              </div>
            )}

            {loadError && (
              <Notice
                tone="error"
                className="mb-6 flex-wrap"
                action={<Button
                  variant="outline"
                  onClick={() => fetchQuizzes()}
                  className="border-danger-border bg-surface text-danger-ink hover:bg-danger-soft"
                >
                  تلاش دوباره
                </Button>}
              >
                {loadError}
              </Notice>
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
          <div className="flex items-center gap-6 rounded-lg bg-content px-6 py-4 text-content-inverse shadow-2xl">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {formatNumber(selectedQuizzes.length)} انتخاب‌شده
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
              <button
                onClick={handleMoveToTrash}
                className="flex items-center gap-2 text-sm text-danger-border transition hover:text-content-inverse"
              >
                <Trash2 className="w-4 h-4" />
                حذف ارائه‌ها
              </button>
            </div>
            <button
              onClick={() => setSelectedQuizzes([])}
              className="ms-4 hover:bg-gray-600 rounded p-1 transition"
              aria-label="لغو انتخاب ارائه‌ها"
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
            activeMenuButtonRef.current = null;
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
