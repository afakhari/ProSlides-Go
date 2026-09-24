import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../shared/ui/primitives/Button.tsx";
import { ConfirmDialog } from "../../../shared/ui/primitives/ConfirmDialog.tsx";
import { ErrorModal } from "../../../pages/quiz/manager/ErrorModal";
import { quizService } from "../api/presentationRepository.ts";
import {
  presentationKeys,
  presentationListQuery,
} from "../api/presentationQueries.ts";
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
  Presentation,
  BarChart3,
  RotateCcw,
  Share2,
  FileText,
  Users,
} from "lucide-react";
import ShareMenu from "../sharing/ShareDialog";
import { apiFetch } from "../../../utils/apiFetch";
import { clearAuthStorage } from "../../../utils/auth";
import { getPresentationValidationError } from "../editor/model/validation";
import { createPresentationOnce } from "../model/createPresentationFlow.ts";
import Notice from "../../../shared/ui/Notice";
import { fa } from "../../../shared/i18n/fa";
import {
  formatNumber,
  getDuplicateTitle,
  getVersionInfo,
  normalizePersianText,
  persianCollator,
  toDashboardQuiz,
  toPersianUiMessage,
} from "./model/dashboardPresentation.ts";

export default function QuizManager({ onNewPresentation }) {
  const navigate = useNavigate();
  const [loggedInUser] = useState(
    () => readLocalStorage("auth.name") || "شما"
  );
  const queryClient = useQueryClient();
  const {
    data: presentationSummaries = EMPTY_PRESENTATION_SUMMARIES,
    isPending: loading,
    isError: hasLoadError,
    refetch: refetchPresentations,
  } = useQuery(presentationListQuery());
  const quizzes = useMemo(
    () => presentationSummaries.map((quiz) => toDashboardQuiz(quiz, loggedInUser)),
    [presentationSummaries, loggedInUser],
  );
  const loadError = hasLoadError
    ? "بارگذاری ارائه‌ها انجام نشد. اتصال خود را بررسی کنید و دوباره تلاش کنید."
    : null;
  const refreshPresentations = useCallback(async () => {
    const result = await refetchPresentations();
    return !result.isError;
  }, [refetchPresentations]);

  const [statusMessage, setStatusMessage] = useState(null);
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordPromptStatus, setPasswordPromptStatus] = useState(null);
  const [passwordPromptLoading, setPasswordPromptLoading] = useState(false);
  const [errorForModal, setErrorForModal] = useState(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);

  const closeErrorModal = () => {
    setErrorModalOpen(false);
  };

  useEffect(() => {
    if (!statusMessage) return;
    const timeoutId = setTimeout(
      () => setStatusMessage(null),
      statusMessage.type === "error" ? 6000 : 3500
    );
    return () => clearTimeout(timeoutId);
  }, [statusMessage]);

  useEffect(() => {
    const promptFlag = readLocalStorage("auth.promptSetPassword");
    const email = readLocalStorage("auth.email");
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

  useEffect(() => {
    const validIds = new Set(quizzes.map((quiz) => quiz.id));
    setSelectedQuizzes((previous) => {
      const next = previous.filter((id) => validIds.has(id));
      return next.length === previous.length ? previous : next;
    });
  }, [quizzes]);
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
  const duplicationLocksRef = useRef(new Set());
  const cancelledRenameIdsRef = useRef(new Set());
  const activeRenameIdRef = useRef(null);
  const presentationLaunchGateRef = useRef(false);
  const [presentingQuizId, setPresentingQuizId] = useState(null);

  const closeActionMenu = useCallback(({ restoreFocus = false } = {}) => {
    setShowMenu(null);
    if (restoreFocus) activeMenuButtonRef.current?.focus?.();
    activeMenuButtonRef.current = null;
  }, []);

  // Create a new quiz via API and navigate to editor
  const handleNewPresentation = async () => {
    if (creationGateRef.current) return;
    try {
      setCreatingQuiz(true);
      setCreationError(null);
      await createPresentationOnce({
        gate: creationGateRef,
        create: async (title) => {
          const created = await quizService.createPresentation(title);
          await queryClient.invalidateQueries({ queryKey: presentationKeys.list() });
          return created;
        },
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
  const hasSearchQuery = normalizedSearchQuery.length > 0;
  const filteredQuizzes = quizzes
    .filter((quiz) =>
      normalizePersianText(
        [quiz.name, quiz.accessCode, quiz.createdBy].filter(Boolean).join(" ")
      ).includes(normalizedSearchQuery)
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
  const selectedOutsideFilterCount = Math.max(
    0,
    selectedQuizzes.length - selectedInFilterCount
  );
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
      setSelectedQuizzes((prev) => prev.filter((id) => id !== quizId));
      if (manageLoadingState) {
        await refreshPresentations();
      }
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
      await quizService.updateQuiz(quizId, {
        title: trimmedName,
        revision: currentQuiz?.revision,
      });

      const refreshed = await refreshPresentations();
      setStatusMessage({
        type: refreshed ? "success" : "error",
        message: refreshed
          ? "نام ارائه تغییر کرد."
          : "نام ارائه تغییر کرد، اما به‌روزرسانی فهرست انجام نشد.",
      });
      return true;
    } catch (err) {
      console.error("Error renaming presentation:", err);
      if (err.response?.status === 409 && err.response?.data?.error === "edit_conflict") {
        const refreshed = await refreshPresentations();
        setStatusMessage({
          type: "error",
          message: refreshed
            ? "این ارائه در جای دیگری تغییر کرده بود؛ آخرین نسخه بارگذاری شد."
            : "این ارائه در جای دیگری تغییر کرده است و دریافت آخرین نسخه هم انجام نشد. صفحه را دوباره بارگذاری کنید.",
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

  const startRenaming = (quiz) => {
    cancelledRenameIdsRef.current.delete(quiz.id);
    activeRenameIdRef.current = quiz.id;
    setNewQuizName(quiz.name);
    setRenamingQuiz(quiz.id);
  };

  const cancelRenaming = (quiz) => {
    cancelledRenameIdsRef.current.add(quiz.id);
    if (activeRenameIdRef.current === quiz.id) activeRenameIdRef.current = null;
    setNewQuizName(quiz.name);
    setRenamingQuiz(null);
  };

  const commitRenaming = async (quiz) => {
    if (cancelledRenameIdsRef.current.has(quiz.id)) {
      cancelledRenameIdsRef.current.delete(quiz.id);
      return;
    }

    const nextName = newQuizName.trim();
    if (!nextName) {
      setNewQuizName(quiz.name);
      setStatusMessage({ type: "error", message: "نام ارائه نمی‌تواند خالی باشد." });
      if (activeRenameIdRef.current === quiz.id) activeRenameIdRef.current = null;
      setRenamingQuiz((current) => (current === quiz.id ? null : current));
      return;
    }

    if (nextName !== quiz.name) {
      const success = await renameQuiz(quiz.id, nextName);
      if (!success && activeRenameIdRef.current === quiz.id) {
        setNewQuizName(quiz.name);
      }
    }

    if (activeRenameIdRef.current === quiz.id) activeRenameIdRef.current = null;
    setRenamingQuiz((current) => (current === quiz.id ? null : current));
  };

  const resetQuizResults = async (quizId) => {
    try {
      const quiz = quizzes.find((item) => item.id === quizId);
      if (!quiz) throw new Error("presentation_not_found");

      await quizService.resetPresentationResults(quizId);
      const refreshed = await refreshPresentations();
      setStatusMessage({
        type: refreshed ? "success" : "error",
        message: refreshed
          ? "نتایج ارائه با موفقیت پاک شد."
          : "نتایج پاک شد، اما به‌روزرسانی فهرست انجام نشد.",
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

  const handleDeleteSelected = async () => {
    if (selectedQuizzes.length === 0) return;

    const selectedCount = selectedQuizzes.length;
    showConfirmDialog({
      title: "حذف ارائه‌ها",
      description: selectedOutsideFilterCount > 0
        ? `آیا از حذف ${formatNumber(selectedCount)} ارائه مطمئن هستید؟ ${formatNumber(selectedOutsideFilterCount)} مورد در نتایج فعلی دیده نمی‌شود. این کار قابل بازگشت نیست.`
        : `آیا از حذف ${formatNumber(selectedCount)} ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.`,
      confirmText: "حذف",
      cancelText: "انصراف",
      confirmVariant: "destructive",
      onConfirm: async () => {
        const idsToDelete = [...selectedQuizzes];
        setDeletingQuizIds(idsToDelete);
        try {
          const results = [];
          const batchSize = 5;
          for (let index = 0; index < idsToDelete.length; index += batchSize) {
            const batch = idsToDelete.slice(index, index + batchSize);
            const batchResults = await Promise.all(
              batch.map((id) => deleteQuiz(id, false))
            );
            results.push(...batchResults);
          }
          const failedCount = results.filter((result) => !result).length;
          const refreshed = await refreshPresentations();

          if (failedCount === 0) {
            setSelectedQuizzes([]);
            setStatusMessage({
              type: "success",
              message: refreshed
                ? `${formatNumber(selectedCount)} ارائه حذف شد.`
                : `${formatNumber(selectedCount)} ارائه حذف شد، اما به‌روزرسانی فهرست از سرور انجام نشد.`,
            });
          } else {
            setStatusMessage({
              type: "error",
              message: refreshed
                ? `حذف ${formatNumber(failedCount)} ارائه انجام نشد.`
                : `حذف ${formatNumber(failedCount)} ارائه انجام نشد و به‌روزرسانی فهرست از سرور هم ممکن نشد.`,
            });
          }
        } finally {
          setDeletingQuizIds([]);
        }
      },
    });
  };

  const handleDeleteQuiz = async (quizId) => {
    closeActionMenu();
    showConfirmDialog({
      title: "حذف ارائه",
      description: "آیا از حذف این ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.",
      confirmText: "حذف",
      cancelText: "انصراف",
      confirmVariant: "destructive",
      onConfirm: async () => {
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
    const baseKey = normalizePersianText(getVersionInfo(quiz.name).baseName);
    if (duplicationLocksRef.current.has(baseKey)) return;

    duplicationLocksRef.current.add(baseKey);
    try {
      setDuplicatingQuizIds((prev) => [...new Set([...prev, quiz.id])]);
      const newName = getDuplicateTitle(quiz, quizzes);
      const duplicated = await quizService.duplicatePresentation(quiz.id, newName);
      if (!duplicated?.id) throw new Error("invalid_duplicate_response");

      const refreshed = await refreshPresentations();
      setStatusMessage({
        type: refreshed ? "success" : "error",
        message: refreshed
          ? "یک نسخه از ارائه ساخته شد."
          : "نسخه جدید ساخته شد، اما به‌روزرسانی فهرست انجام نشد.",
      });
    } catch (err) {
      console.error("Error duplicating presentation:", err);
      setStatusMessage({
        type: "error",
        message: "تکثیر ارائه انجام نشد. دوباره تلاش کنید.",
      });
    } finally {
      duplicationLocksRef.current.delete(baseKey);
      setDuplicatingQuizIds((prev) => prev.filter((id) => id !== quiz.id));
      closeActionMenu();
    }
  };

  // Handle present click
  const handlePresent = async (quizId) => {
    if (presentationLaunchGateRef.current) return;

    presentationLaunchGateRef.current = true;
    setPresentingQuizId(quizId);
    try {
      const quiz = await quizService.getQuiz(quizId);

      if (!quiz.slides || quiz.slides.length === 0) {
        setErrorForModal("این ارائه هنوز اسلایدی ندارد.");
        setErrorModalOpen(true);
        return;
      }

      const validationError = getPresentationValidationError(quiz);
      if (validationError) {
        setErrorForModal(toPersianUiMessage(validationError, "اطلاعات ارائه برای اجرا کامل نیست. اسلایدها و پرسش‌ها را بررسی کنید."));
        setErrorModalOpen(true);
        return;
      }

      navigate(`/manager/presentation/${quizId}/`);
    } catch {
      setErrorForModal("بارگذاری ارائه انجام نشد. دوباره تلاش کنید.");
      setErrorModalOpen(true);
    } finally {
      presentationLaunchGateRef.current = false;
      setPresentingQuizId(null);
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
    removeLocalStorage("auth.promptSetPassword");
    setPasswordPromptVisible(false);
  };

  const sendPasswordSetupEmail = async () => {
    const email = readLocalStorage("auth.email");
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
        message: toPersianUiMessage(err?.message, "ارسال لینک تعیین رمز عبور انجام نشد."),
      });
    } finally {
      setPasswordPromptLoading(false);
    }
  };

  const handleProfileToggle = (event) => {
    event.stopPropagation();
    const trigger = event.currentTarget;
    const willOpen = !showProfileMenu;

    setShowProfileMenu(willOpen);
    closeActionMenu();
    setShowMobileSearch(false);

    if (willOpen) {
      requestAnimationFrame(() => {
        trigger.parentElement?.querySelector('[role="menuitem"]')?.focus();
      });
    }
  };

  const handleAccountMenuKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      const trigger = event.currentTarget.parentElement?.querySelector(
        'button[aria-haspopup="menu"]'
      );
      setShowProfileMenu(false);
      requestAnimationFrame(() => trigger?.focus());
      return;
    }

    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      event.currentTarget.querySelector('[role="menuitem"]')?.focus();
    }
  };

  const checkMenuPosition = useCallback((buttonElement) => {
    if (!buttonElement) return;

    const rect = buttonElement.getBoundingClientRect();
    const menuHeight =
      buttonElement.parentElement
        ?.querySelector('[role="menu"]')
        ?.getBoundingClientRect().height || 390;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    setMenuPosition(spaceBelow >= menuHeight || spaceBelow >= spaceAbove ? "bottom" : "top");
  }, []);

  const focusFirstActionMenuItem = useCallback(() => {
    activeMenuButtonRef.current?.parentElement
      ?.querySelector('[role="menu"] [role="menuitem"]:not(:disabled)')
      ?.focus();
  }, []);

  const handleActionMenuKeyDown = useCallback((event) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll('[role="menuitem"]:not(:disabled)')
    );
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeActionMenu({ restoreFocus: true });
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        currentIndex < 0
          ? direction > 0
            ? 0
            : items.length - 1
          : (currentIndex + direction + items.length) % items.length;
      items[nextIndex].focus();
    }
  }, [closeActionMenu]);

  const handleMenuToggle = (quizId, event) => {
    event.stopPropagation();

    if (showMenu === quizId) {
      closeActionMenu();
      return;
    }

    setShowProfileMenu(false);
    setShowMobileSearch(false);
    activeMenuButtonRef.current = event.currentTarget;
    setShowMenu(quizId);
    requestAnimationFrame(() => {
      checkMenuPosition(activeMenuButtonRef.current);
      focusFirstActionMenuItem();
    });
  };

  useEffect(() => {
    if (showMenu === null) return undefined;

    const handlePositionUpdate = () => checkMenuPosition(activeMenuButtonRef.current);
    window.addEventListener("scroll", handlePositionUpdate, true);
    window.addEventListener("resize", handlePositionUpdate);

    return () => {
      window.removeEventListener("scroll", handlePositionUpdate, true);
      window.removeEventListener("resize", handlePositionUpdate);
    };
  }, [showMenu, checkMenuPosition]);

  useEffect(() => {
    if (showMenu === null && !showProfileMenu && !showMobileSearch) return undefined;

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (showMenu !== null) closeActionMenu({ restoreFocus: true });
      setShowProfileMenu(false);
      setShowMobileSearch(false);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showMenu, showProfileMenu, showMobileSearch, closeActionMenu]);

  const renderActionMenu = (quiz) => {
    const positionClass =
      menuPosition === "top" ? "bottom-full mb-2" : "top-full mt-2";

    return (
      <div
        role="menu"
        aria-label={`عملیات ارائه ${quiz.name}`}
        onKeyDown={handleActionMenuKeyDown}
        className={`absolute end-0 ${positionClass} z-[60] max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg`}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            closeActionMenu();
            void handlePresent(quiz.id);
          }}
          disabled={presentingQuizId !== null}
          className="flex w-full items-center gap-3 px-4 py-3 text-start font-medium text-brand hover:bg-brand-soft focus:bg-brand-soft focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {presentingQuizId === quiz.id ? (
            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {presentingQuizId === quiz.id ? "در حال آماده‌سازی…" : "اجرا"}
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            startRenaming(quiz);
            closeActionMenu();
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-start text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          تغییر نام
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            closeActionMenu();
            navigate(`/manager/panel/${quiz.id}/report`);
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-start text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
        >
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          گزارش
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setShowShareModal(quiz.id);
            closeActionMenu();
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-start text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          اشتراک‌گذاری
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => void handleDuplicate(quiz)}
          disabled={duplicatingQuizIds.includes(quiz.id)}
          className="flex w-full items-center gap-3 px-4 py-3 text-start text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {duplicatingQuizIds.includes(quiz.id) ? (
            <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {duplicatingQuizIds.includes(quiz.id) ? "در حال تکثیر…" : "تکثیر"}
        </button>
        <div role="separator" className="my-1 h-px bg-gray-100" />
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            closeActionMenu();
            showConfirmDialog({
              title: "پاک‌کردن نتایج ارائه",
              description:
                "آیا از پاک‌کردن همه نتایج این ارائه مطمئن هستید؟ این کار قابل بازگشت نیست.",
              confirmText: "پاک‌کردن نتایج",
              confirmVariant: "destructive",
              onConfirm: async () => {
                await resetQuizResults(quiz.id);
              },
            });
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-start text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          پاک‌کردن نتایج
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => handleDeleteQuiz(quiz.id)}
          className="flex w-full items-center gap-3 border-t border-border-subtle px-4 py-3 text-start text-danger hover:bg-danger-soft focus:bg-danger-soft focus:outline-none"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          حذف
        </button>
      </div>
    );
  };

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
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMobileSearch((open) => !open);
                    setShowProfileMenu(false);
                    closeActionMenu();
                  }}
                  className={`p-1.5 rounded-lg transition ${
                    showMobileSearch
                      ? "bg-brand-muted text-brand"
                      : "hover:bg-gray-100 text-gray-600"
                  }`}
                  aria-label="نمایش جست‌وجو"
                  title="جست‌وجو"
                >
                  <Search className="w-5 h-5" aria-hidden="true" />
                </button>
                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleProfileToggle}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-brand text-sm font-semibold text-content-inverse transition hover:bg-brand-strong"
                    aria-label="باز کردن منوی حساب"
                    aria-haspopup="menu"
                    aria-expanded={showProfileMenu}
                    aria-controls="account-menu-mobile"
                  >
                    {loggedInUser.charAt(0).toUpperCase()}
                  </button>
                  {showProfileMenu && (
                    <div id="account-menu-mobile" role="menu" onKeyDown={handleAccountMenuKeyDown} className="absolute end-0 top-full z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleLogout()}
                        className="flex w-full items-center gap-3 px-4 py-3 text-start text-gray-700 hover:bg-gray-50"
                      >
                        <LogOut className="w-4 h-4" aria-hidden="true" />
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
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="جست‌وجوی ارائه‌ها"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setSearchQuery("");
                    }}
                    aria-label="جست‌وجوی ارائه‌ها"
                    autoFocus
                    className="w-full rounded-control border border-border-subtle bg-surface py-2 pe-10 ps-10 text-sm text-content transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label="پاک کردن جست‌وجو"
                        title="پاک کردن جست‌وجو"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
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
              <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                placeholder="جست‌وجوی ارائه‌ها"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearchQuery("");
                }}
                aria-label="جست‌وجوی ارائه‌ها"
                className="w-full rounded-control border border-border-subtle bg-canvas py-2.5 pe-10 ps-12 text-content transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-focus"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="پاک کردن جست‌وجو"
                  title="پاک کردن جست‌وجو"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Profile Dropdown */}
              <div className="relative">
                  <button
                    type="button"
                    onClick={handleProfileToggle}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-brand font-semibold text-content-inverse transition hover:bg-brand-strong"
                    aria-label="باز کردن منوی حساب"
                    aria-haspopup="menu"
                    aria-expanded={showProfileMenu}
                    aria-controls="account-menu-desktop"
                    title="حساب کاربری"
                  >
                  {loggedInUser.charAt(0).toUpperCase()}
                </button>

                {showProfileMenu && (
                  <div id="account-menu-desktop" role="menu" onKeyDown={handleAccountMenuKeyDown} className="absolute end-0 top-full z-50 mt-2 w-48 rounded-xl border border-gray-200 bg-white shadow-lg">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleLogout()}
                      className="flex w-full items-center gap-3 px-4 py-3 text-start text-gray-700 hover:bg-gray-50"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
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
                    type="button"
                    onClick={sendPasswordSetupEmail}
                    disabled={passwordPromptLoading}
                    className="rounded-control bg-brand px-3 py-1.5 text-xs font-semibold text-content-inverse hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {passwordPromptLoading ? "در حال ارسال…" : "ارسال لینک"}
                  </button>
                  <button
                    type="button"
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
              <p className="mb-2 text-sm font-semibold text-brand">{fa.dashboard.eyebrow}</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                {fa.dashboard.title}
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
                      {fa.dashboard.newPresentation}
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
                    className="cursor-pointer appearance-none rounded-control border border-border-subtle bg-surface py-2.5 pe-10 ps-4 text-sm text-content focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    <option value="updated">آخرین ویرایش</option>
                    <option value="name">نام</option>
                    <option value="created">تاریخ ساخت</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" aria-hidden="true" />
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
                  {hasSearchQuery ? "نتیجه‌ای پیدا نشد" : "اولین ارائه‌تان را بسازید"}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {hasSearchQuery
                    ? "عبارت دیگری را امتحان کنید یا جست‌وجو را پاک کنید."
                    : "از یک ارائه خالی شروع کنید و اولین اسلاید را در ویرایشگر بسازید."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {hasSearchQuery ? (
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
                    {creatingQuiz ? "در حال ساخت…" : fa.dashboard.createFirstPresentation}
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
                    <caption className="sr-only">فهرست ارائه‌ها</caption>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="text-start px-6 py-3 text-sm font-medium text-gray-600">
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
                    <th scope="col" className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      نام
                    </th>
                    <th scope="col" className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      کد ورود
                    </th>
                    <th scope="col" className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      سازنده
                    </th>
                    <th scope="col" className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      آخرین ویرایش
                    </th>
                    <th scope="col" className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      تاریخ ساخت
                    </th>
                    <th scope="col" className="text-start px-6 py-3 text-sm font-medium text-gray-600">
                      <span className="sr-only">عملیات</span>
                    </th>
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
                          <div className="flex h-12 w-16 items-center justify-center rounded bg-brand-soft text-brand" aria-hidden="true">
                            <Presentation className="h-6 w-6" />
                          </div>
                          <div>
                            {renamingQuiz === quiz.id ? (
                              <input
                                type="text"
                                value={newQuizName}
                                onChange={(e) => setNewQuizName(e.target.value)}
                                onBlur={() => void commitRenaming(quiz)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.currentTarget.blur();
                                  } else if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelRenaming(quiz);
                                  }
                                }}
                                autoFocus
                                aria-label={`نام ارائه ${quiz.name}`}
                                dir="auto"
                                className="rounded border border-brand px-2 py-1 font-semibold text-content focus:outline-none focus:ring-2 focus:ring-focus"
                              />
                            ) : (
                              <div className="font-semibold text-content" dir="auto">
                                {quiz.name}
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                              <span className="inline-flex items-center gap-1" aria-label={`تعداد اسلایدها: ${formatNumber(quiz.slides)}`}>
                                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                {formatNumber(quiz.slides)} اسلاید
                              </span>
                              <span className="inline-flex items-center gap-1" aria-label={`تعداد شرکت‌کنندگان: ${formatNumber(quiz.participants)}`}>
                                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                {formatNumber(quiz.participants)} شرکت‌کننده
                              </span>
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
                            type="button"
                            onClick={() => setShowShareModal(quiz.id)}
                            className="p-1 hover:bg-gray-200 rounded transition opacity-0 group-hover/access:opacity-100 focus:opacity-100"
                            aria-label={`ویرایش یا اشتراک کد ورود ${quiz.name}`}
                          >
                            <Share2 className="h-4 w-4 text-gray-500" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-content-inverse">
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
                            onClick={() => void handlePresent(quiz.id)}
                            disabled={presentingQuizId !== null}
                            className="rounded-control bg-brand-strong px-4 py-2 text-sm text-content-inverse hover:bg-brand disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {presentingQuizId === quiz.id ? "در حال آماده‌سازی…" : "اجرا"}
                          </Button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => handleMenuToggle(quiz.id, e)}
                              className="p-2 hover:bg-gray-200 rounded transition"
                              aria-label={`باز کردن منوی عملیات ${quiz.name}`}
                              aria-haspopup="menu"
                              aria-expanded={showMenu === quiz.id}
                            >
                              <MoreVertical className="w-5 h-5 text-gray-600" aria-hidden="true" />
                            </button>
                            {showMenu === quiz.id && renderActionMenu(quiz)}
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
                      <div className="flex h-12 min-w-12 items-center justify-center rounded-lg bg-brand-soft text-brand shadow-sm" aria-hidden="true">
                        <Presentation className="h-6 w-6" />
                      </div>
                      <div className="truncate min-w-0 flex-1">
                        {renamingQuiz === quiz.id ? (
                          <input
                            type="text"
                            value={newQuizName}
                            onChange={(e) => setNewQuizName(e.target.value)}
                            onBlur={() => void commitRenaming(quiz)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") event.currentTarget.blur();
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelRenaming(quiz);
                              }
                            }}
                            autoFocus
                            aria-label={`نام ارائه ${quiz.name}`}
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
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1" aria-label={`تعداد اسلایدها: ${formatNumber(quiz.slides)}`}>
                            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatNumber(quiz.slides)} اسلاید
                          </span>
                          <span className="inline-flex items-center gap-1" aria-label={`تعداد شرکت‌کنندگان: ${formatNumber(quiz.participants)}`}>
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatNumber(quiz.participants)} شرکت‌کننده
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative ms-2">
                      <button
                        type="button"
                        onClick={(e) => handleMenuToggle(quiz.id, e)}
                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                        aria-label={`باز کردن منوی عملیات ${quiz.name}`}
                        aria-haspopup="menu"
                        aria-expanded={showMenu === quiz.id}
                      >
                        <MoreVertical className="w-5 h-5 text-gray-500" aria-hidden="true" />
                      </button>

                      {showMenu === quiz.id && renderActionMenu(quiz)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-5 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                    <div>
                      <span className="mb-1 block text-[10px] font-medium text-gray-400">
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
                    <div className="text-start">
                      <span className="mb-1 block text-[10px] font-medium text-gray-400">
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
                      onClick={() => void handlePresent(quiz.id)}
                      disabled={presentingQuizId !== null}
                      className="h-10 flex-1 bg-brand text-sm font-medium tracking-wide text-content-inverse shadow-sm hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {presentingQuizId === quiz.id ? "در حال آماده‌سازی…" : "اجرا"}
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
                  onClick={() => void refreshPresentations()}
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
      {showShareModal !== null && (
        <ShareMenu
          isOpen={true}
          onClose={() => setShowShareModal(null)}
          quizId={showShareModal}
          accessCode={quizzes.find((q) => q.id === showShareModal)?.accessCode}
          onAccessCodeSaved={() => {
            void queryClient.invalidateQueries({ queryKey: presentationKeys.list() });
          }}
        />
      )}

      {/* Bottom Action Bar */}
      {selectedQuizzes.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-50 flex justify-center md:inset-x-auto md:left-1/2 md:-translate-x-1/2">
          <div className="flex max-w-full flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-content px-5 py-3 text-content-inverse shadow-2xl">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {formatNumber(selectedQuizzes.length)} انتخاب‌شده
                {selectedOutsideFilterCount > 0
                  ? ` (${formatNumber(selectedOutsideFilterCount)} مورد خارج از نتایج فعلی)`
                  : ""}
              </span>
              {!allSelected && (
                <button
                  type="button"
                  onClick={handleBottomBarSelectAll}
                  className="text-sm hover:text-gray-300 transition flex items-center gap-2"
                >
                  <span className="text-lg" aria-hidden="true">⚡</span>
                  انتخاب همه نتایج فعلی
                </button>
              )}
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 text-sm text-danger-border transition hover:text-content-inverse"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                حذف ارائه‌ها
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelectedQuizzes([])}
              className="ms-4 hover:bg-gray-600 rounded p-1 transition"
              aria-label="لغو انتخاب ارائه‌ها"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Close menu when clicking outside */}
      {(showMenu !== null || showProfileMenu || showMobileSearch) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            closeActionMenu();
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
