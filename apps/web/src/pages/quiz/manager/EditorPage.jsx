import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import MiniResultsResultsOnly from "./MiniResultsResultsOnly";
import LeaderboardPreview from "./LeaderboardPreview";
import QuizHeader from "../../../components/QuizHeader";
import Sidebar from "./Sidebar";
import SlidesPanel from "./SlidesPanel";
import RightToolbar from "./RightToolbar";
import DesignPanel from "./DesignPanel";
import AudioPanel from "./AudioPanel";
import ContentSidebar from "./ContentSidebar";
import { quizService } from "../../../services/quizService.ts";
import { getPresentationValidationError } from "./questionValidation";
import { UNSAVED_CHANGES_KEY } from "../../../utils/auth";
import { X, ArrowRight, Plus, RefreshCw, Sparkles } from "lucide-react";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import EditorRouteSkeleton from "../../../modules/presentations/ui/EditorRouteSkeleton";
import Notice from "../../../shared/ui/Notice";
import { fa } from "../../../shared/i18n/fa";

export default function EditorPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const quizId = roomId?.trim() || "";

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchSequenceRef = useRef(0);

  const fetchQuiz = useCallback(async () => {
    const sequence = ++fetchSequenceRef.current;
    if (!quizId) {
      setError("There is no quiz.");
      setLoading(false);
      return;
    }

    try {
      const quizData = await quizService.getEditorQuiz(quizId);
      if (sequence !== fetchSequenceRef.current) return;
      setQuiz(quizData);
      setError(null);
    } catch (err) {
      if (sequence !== fetchSequenceRef.current) return;
      setError("Failed to load quiz");
      console.error(err);
    } finally {
      if (sequence === fetchSequenceRef.current) setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchQuiz();
    return () => {
      fetchSequenceRef.current += 1;
    };
  }, [fetchQuiz]);

  const updateQuiz = (updatedQuiz) => {
    setQuiz(updatedQuiz);
  };

  if (loading) {
    return <EditorRouteSkeleton />;
  }

  if (error || !quiz) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-soft px-4" dir="rtl">
        <div className="w-full max-w-md rounded-3xl border border-danger-border bg-surface p-8 text-center shadow-panel">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
            <RefreshCw className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-xl font-black text-slate-900">ویرایشگر بارگذاری نشد</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            اتصال را بررسی کنید و دوباره تلاش کنید. تغییر ذخیره‌نشده‌ای در این صفحه ایجاد نشده است.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={fetchQuiz} className="rounded-control bg-brand px-5 py-3 font-bold text-content-inverse hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              تلاش دوباره
            </button>
            <button type="button" onClick={() => navigate("/manager/panel")} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 hover:bg-slate-50">
              {fa.managerShell.backToDashboard}
            </button>
          </div>
          <span className="sr-only">{error || "ارائه پیدا نشد"}</span>
        </div>
      </div>
    );
  }

  return (
    <QuestionEditor
      quiz={quiz}
      updateQuiz={updateQuiz}
      refreshQuiz={fetchQuiz}
      createdPresentation={location.state?.createdPresentation === true}
    />
  );
}


function QuestionEditor({ quiz, updateQuiz, refreshQuiz, createdPresentation }) {

  const [activeSlideId, setActiveSlideId] = useState(
    () => quiz.slides?.[0]?.slide_id || null
  );
  const navigate = useNavigate();
  const [activeSlideType, setActiveSlideType] = useState(null);
  const [leaderboardPreviewData, setLeaderboardPreviewData] = useState({});
  const [leaderboardError, setLeaderboardError] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState({});
  const [hasSidebarChanges, setHasSidebarChanges] = useState(false);
  const [hasAudioChanges, setHasAudioChanges] = useState(false);
  const [hasDesignChanges, setHasDesignChanges] = useState(false);
  const [isSelectingType, setIsSelectingType] = useState(false);
  const [isAddingSlide, setIsAddingSlide] = useState(false);
  const addSlideGateRef = useRef(false);
  const [typeSelectionError, setTypeSelectionError] = useState(null);
  const [typeSelectionNotice, setTypeSelectionNotice] = useState(null);
  const [typeSelectionMode, setTypeSelectionMode] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [notice, setNotice] = useState(null);
  const noticeTimeoutRef = useRef(null);
  const [audioSaveNotice, setAudioSaveNotice] = useState(null);
  const [backgroundSaveNotice, setBackgroundSaveNotice] = useState(null);
  const hasUnsavedChanges = hasSidebarChanges || hasAudioChanges || hasDesignChanges;

  const slides = quiz.slides;
  const activeSlide = slides.find((slide) => slide.slide_id === activeSlideId) || slides[0] || null;
  const activeLeaderboardEntries = activeSlide?.slide_id
    ? leaderboardPreviewData[activeSlide.slide_id] || []
    : [];
  const presentStatus = (() => {
    if (hasUnsavedChanges) {
      return { ready: false, reason: "Save or discard your changes before presenting." };
    }
    const validationError = getPresentationValidationError(quiz);
    if (validationError) return { ready: false, reason: validationError };
    return { ready: true, reason: "Start presentation" };
  })();

  const [activeTab, setActiveTab] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showTypeBox, setShowTypeBox] = useState(false);
  const [showSlidesPanel, setShowSlidesPanel] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: null,
    confirmText: "",
    cancelText: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasUnsavedChanges) {
      localStorage.setItem(UNSAVED_CHANGES_KEY, "1");
    } else {
      localStorage.removeItem(UNSAVED_CHANGES_KEY);
    }
    return () => {
      localStorage.removeItem(UNSAVED_CHANGES_KEY);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!slides.length) {
      if (activeSlideId !== null) setActiveSlideId(null);
      return;
    }
    if (!slides.some((slide) => slide.slide_id === activeSlideId)) {
      setActiveSlideId(slides[0].slide_id);
    }
  }, [slides, activeSlideId]);

  useEffect(() => {
    if (!activeSlide) return;
    if (activeSlideType === null || activeSlideType === activeSlide.slide_type) {
      setActiveSlideType(activeSlide.slide_type);
    }
  }, [activeSlide, activeSlideType]);

  const showNotice = useCallback((message, tone = "info", pending = false) => {
    setNotice({ message, tone, pending });
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    if (!pending) {
      noticeTimeoutRef.current = setTimeout(() => {
        setNotice(null);
      }, 3000);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const media = window.matchMedia("(max-width: 767px), (max-height: 600px)");
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const shouldLock =
      isMobile &&
      (showSlidesPanel ||
        showSidebar ||
        showDesignPanel ||
        showAudioPanel ||
        showTypeBox);
    if (shouldLock) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [
    isMobile,
    showSlidesPanel,
    showSidebar,
    showDesignPanel,
    showAudioPanel,
    showTypeBox,
  ]);

  const loadLeaderboardPreview = useCallback(async (slideId) => {
    if (!slideId) return;
    try {
      setLeaderboardLoading((prev) => ({ ...prev, [slideId]: true }));
      const data = await quizService.getQuestionLeaderboard(
        quiz.quiz_id,
        slideId
      );
      setLeaderboardPreviewData((prev) => ({
        ...prev,
        [slideId]: data || [],
      }));
      setLeaderboardError(null);
    } catch (error) {
      console.error("Failed to load leaderboard preview:", error);
      setLeaderboardError("Failed to load leaderboard results.");
    } finally {
      setLeaderboardLoading((prev) => ({ ...prev, [slideId]: false }));
    }
  }, [quiz.quiz_id]);

  useEffect(() => {
    if (activeSlideType === 3 && activeSlide?.slide_id) {
      loadLeaderboardPreview(activeSlide.slide_id);
    }
  }, [activeSlideType, activeSlide?.slide_id, loadLeaderboardPreview]);


  const handleDeleteLeaderboardAndRefresh = async () => {
    try {
      if (refreshQuiz) {
        await refreshQuiz();
      }
    } catch (error) {
      console.error("Failed to refresh after leaderboard update:", error);
    }
  };


  // ????? ???? ?????? ?????
  const handleTabClick = (tabId) => {
    if (showSidebar && hasSidebarChanges) {
      const isTogglingSidebar = tabId === "content" && showSidebar;
      const isLeavingSidebar = tabId !== "content";
      if (isTogglingSidebar || isLeavingSidebar) {
        setConfirmDialog({
          isOpen: true,
          title: "Unsaved Changes",
          description: "You have unsaved changes. Do you want to discard them?",
          onConfirm: () => {
            setHasSidebarChanges(false);
            proceedTabChange(tabId);
          },
          confirmText: "Discard Changes",
          cancelText: "Keep Editing",
        });
        return;
      }
    }

    if (showAudioPanel && hasAudioChanges) {
      const isTogglingAudio = tabId === "audio" && showAudioPanel;
      const isLeavingAudio = tabId !== "audio";
      if (isTogglingAudio || isLeavingAudio) {
        setConfirmDialog({
          isOpen: true,
          title: "Unsaved Changes",
          description: "You have unsaved changes. Do you want to discard them?",
          onConfirm: () => {
            setHasAudioChanges(false);
            proceedTabChange(tabId);
          },
          confirmText: "Discard Changes",
          cancelText: "Keep Editing",
        });
        return;
      }
    }

    if (showDesignPanel && hasDesignChanges) {
      const isTogglingDesign = tabId === "design" && showDesignPanel;
      const isLeavingDesign = tabId !== "design";
      if (isTogglingDesign || isLeavingDesign) {
        setConfirmDialog({
          isOpen: true,
          title: "Unsaved Changes",
          description: "You have unsaved changes. Do you want to discard them?",
          onConfirm: () => {
            setHasDesignChanges(false);
            proceedTabChange(tabId);
          },
          confirmText: "Discard Changes",
          cancelText: "Keep Editing",
        });
        return;
      }
    }

    proceedTabChange(tabId);
  };

  const proceedTabChange = (tabId) => {
    if (tabId === "slides") {
      setShowSlidesPanel((prev) => {
        const next = !prev;
        setShowSidebar(false);
        setShowDesignPanel(false);
        setShowAudioPanel(false);
        setActiveTab(next ? tabId : null);
        return next;
      });
      return;
    }
    if (tabId === "audio") {
      setShowAudioPanel((prev) => {
        const next = !prev;
        setShowSidebar(false);
        setShowDesignPanel(false);
        setShowSlidesPanel(false);
        setActiveTab(next ? tabId : null);
        return next;
      });
      return;
    }
    if (tabId === "content") {
      setShowSidebar((prev) => {
        const next = !prev;
        setShowDesignPanel(false);
        setShowAudioPanel(false);
        setShowSlidesPanel(false);
        setActiveTab(next ? tabId : null);
        return next;
      });
      return;
    }
    if (tabId === "design") {
      setShowDesignPanel((prev) => {
        const next = !prev;
        setShowSidebar(false);
        setShowAudioPanel(false);
        setShowSlidesPanel(false);
        setActiveTab(next ? tabId : null);
        return next;
      });
      return;
    }

    setShowSidebar(false);
    setShowDesignPanel(false);
    setShowAudioPanel(false);
    setShowSlidesPanel(false);
    setActiveTab(null);
  };

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    closeConfirmDialog();
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      isOpen: false,
      title: "",
      description: "",
      onConfirm: null,
      confirmText: "",
      cancelText: "",
    });
  };

  const handleCancel = () => {
    closeConfirmDialog();
  };

  const handleExitPanel = () => {
    if (!hasUnsavedChanges) {
      navigate("/manager/panel");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: "Leave panel?",
      description: "You have unsaved changes. Do you want to discard them?",
      onConfirm: () => {
        setHasSidebarChanges(false);
        setHasAudioChanges(false);
        setHasDesignChanges(false);
        navigate("/manager/panel");
      },
      confirmText: "Discard Changes",
      cancelText: "Keep Editing",
    });
  };

  const proceedWithSlideChange = (id) => {
    const slide = slides.find((s) => s.slide_id === id);
    if (slide) {
      setActiveSlideId(slide.slide_id);
    }
  };

  const handleSetActiveSlideId = (id) => {
    if (hasSidebarChanges && id !== activeSlide?.slide_id) {
      setConfirmDialog({
        isOpen: true,
        title: "Unsaved Changes",
        description: "You have unsaved changes. Do you want to discard them?",
        onConfirm: () => {
          setHasSidebarChanges(false);
          proceedWithSlideChange(id);
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }

    proceedWithSlideChange(id);
  };

  const handleSetActiveSlideIdForMobile = (id) => {
    if (hasSidebarChanges && id !== activeSlide?.slide_id) {
      setConfirmDialog({
        isOpen: true,
        title: "Unsaved Changes",
        description: "You have unsaved changes. Do you want to discard them?",
        onConfirm: () => {
          setHasSidebarChanges(false);
          proceedWithSlideChange(id);
          setShowSlidesPanel(false);
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }

    proceedWithSlideChange(id);
    setShowSlidesPanel(false);
  };

  const handleCloseAudioPanel = () => {
    setShowAudioPanel(false);
    setActiveTab(null);
  };

  const handleCloseDesignPanel = () => {
    setShowDesignPanel(false);
    setActiveTab(null);
  };

  const handleCloseSidebarPanel = (forceClose = false) => {
    if (!forceClose && hasSidebarChanges) {
      setConfirmDialog({
        isOpen: true,
        title: "Unsaved Changes",
        description: "You have unsaved changes. Do you want to discard them?",
        onConfirm: () => {
          setHasSidebarChanges(false);
          setShowSidebar(false);
          setActiveTab(null);
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }
    setShowSidebar(false);
    setActiveTab(null);
  };

  // ???? ???? ???? ????? ????? ??????
  const getSlideTitle = (slide) => {
    if (slide.slide_type === 1 && slide.question) {
      return slide.question.text || "Question Slide";
    } else if (slide.slide_type === 2) {
      return slide.title || slide.content_text || "Content Slide";
    } else if (slide.slide_type === 3) {
      return slide.title || "Leaderboard";
    }
    // return `Slide ${slide.order}`;
    return "No Question Yet";
  };

  // ????? ?????? ????
  const addNewSlide = async () => {
    if (addSlideGateRef.current) return null;
    addSlideGateRef.current = true;
    setIsAddingSlide(true);
    try {
      const newSlideData = {
        slide_id: globalThis.crypto.randomUUID(),
        revision: 1,
        order: slides.length,
        slide_type: 1,
        // order: 1,
        show_leaderboard_after: false,
        title: "",
        content_text: "",
        content_image_url: "",
        question: null,
      };

      // ????? ?? ???? ???? ????? ?????? ????
      const createdSlide = await quizService.createSlide(
        quiz.quiz_id,
        newSlideData,
        quiz.revision
      );

      // ??????????? quiz ?? ?????? ????
      const updatedSlides = [...slides, createdSlide];
      updateQuiz({
        ...quiz,
        revision: quiz.revision + 1,
        slides: updatedSlides,
      });

      // ?????? ?????? ????
      setActiveSlideId(createdSlide.slide_id);
      setActiveSlideType(createdSlide.slide_type);
      setShowTypeBox(true);
      return createdSlide;
    } catch (error) {
      console.error("Failed to create new slide:", error);
      showNotice("ساخت اسلاید انجام نشد. دوباره تلاش کنید.", "error");
      return null;
    } finally {
      addSlideGateRef.current = false;
      setIsAddingSlide(false);
    }
  };



  // ??? ??????
  const deleteSlide = async (slideId) => {
    try {
      // ??? ?? ????
      const deletedSlide = slides.find((slide) => slide.slide_id === slideId);
      await quizService.deleteSlide(quiz.quiz_id, slideId, deletedSlide?.revision);

      // ??????????? state
      const slideIndex = slides.findIndex((s) => s.slide_id === slideId);
      const updatedSlides = slides.filter((s) => s.slide_id !== slideId);

      const nextSlide = updatedSlides[Math.min(slideIndex, updatedSlides.length - 1)] || null;
      setActiveSlideId(nextSlide?.slide_id || null);
      await refreshQuiz();
    } catch (error) {
      console.error("Failed to delete slide:", error);
      showNotice("Failed to delete slide.", "error");
    }
  };

  // ????? ??? ????
  const handleTypeChangeClick = () => {
    if (isSelectingType) {
      return;
    }
    if (hasSidebarChanges) {
      setConfirmDialog({
        isOpen: true,
        title: "Change Question Type",
        description:
          "You have unsaved changes. Do you want to discard them before changing the question type?",
        onConfirm: () => {
          setHasSidebarChanges(false);
          handleCloseSidebarPanel(true);
          proceedWithTypeChange();
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }
    proceedWithTypeChange();
  };

  const proceedWithTypeChange = () => {
    setTypeSelectionError(null);
    setTypeSelectionMode(null);
    setShowSlidesPanel(false);
    setShowTypeBox(true);
  };

  const applyQuestionTypeChange = async ({
    currentQuestion,
    questionType,
    quizId,
    slideId,
    requestedMode,
  }) => {
    try {
      setIsSelectingType(true);
      setTypeSelectionError(null);
      setTypeSelectionMode(requestedMode);
      let nextQuestion;

      if (!currentQuestion || !currentQuestion.question_id) {
        nextQuestion = {
          question_id: String(slideId),
          title: "",
          text: "New Question",
          question_text: "New Question",
          question_type: questionType,
          min_point: 0,
          max_point: 100,
          time_limit: 10,
          question_time: 10,
          image_url: "",
          question_image: "",
          faster_answers_more_points: false,
          partial_scoring: false,
          options: [
            { option_id: globalThis.crypto.randomUUID(), text: "Option 1", is_correct: true, image_url: "", order: 1 },
            { option_id: globalThis.crypto.randomUUID(), text: "Option 2", is_correct: false, image_url: "", order: 2 },
          ],
        };
      } else {
        const existingOptions = [...(currentQuestion.options || [])];
        while (existingOptions.length < 2) {
          existingOptions.push({
            option_id: globalThis.crypto.randomUUID(),
            text: `Option ${existingOptions.length + 1}`,
            is_correct: existingOptions.length === 0,
            image_url: "",
            order: existingOptions.length + 1,
          });
        }
        const firstCorrectIndex = existingOptions.findIndex(
          (option) => option.is_correct
        );
        const indexToKeepTrue = firstCorrectIndex !== -1 ? firstCorrectIndex : 0;
        const nextOptions = questionType === "single"
          ? existingOptions.map((option, index) => ({
              ...option,
              is_correct: index === indexToKeepTrue,
              order: index + 1,
            }))
          : existingOptions.map((option, index) => ({
              ...option,
              is_correct: firstCorrectIndex === -1 ? index === 0 : option.is_correct,
              order: index + 1,
            }));

        nextQuestion = {
          ...currentQuestion,
          question_type: questionType,
          partial_scoring:
            questionType === "multiple" && currentQuestion.partial_scoring === true,
          options: nextOptions,
        };
      }

      const updatedSlide = await quizService.updateSlide(quizId, slideId, {
        ...activeSlide,
        slide_type: 1,
        question: nextQuestion,
      });

      // ??????????? ?? state ????
      const updatedSlides = slides.map((s) =>
        s.slide_id === slideId ? updatedSlide : s
      );

      updateQuiz({
        ...quiz,
        revision: quiz.revision + 1,
        slides: updatedSlides,
      });
      setTypeSelectionNotice(
        `Question type set to ${requestedMode === "single" ? "Single Choice" : "Multiple Choice"}.`
      );
      setTimeout(() => {
        setTypeSelectionNotice(null);
      }, 2500);
      setShowTypeBox(false);
      setShowSidebar(true);
      setShowDesignPanel(false);
      setShowAudioPanel(false);
      setActiveTab("content");
    } catch (error) {
      console.error("Error changing question type:", error);

      if (error.response?.status === 409 && error.response?.data?.error === "edit_conflict") {
        await refreshQuiz();
        setTypeSelectionError("This question changed elsewhere. The latest version has been loaded.");
      } else if (error.response?.status === 409 && error.response?.data?.error === "slide_has_results") {
        setTypeSelectionError("This slide has live results. Reset the presentation results before changing its type.");
      } else if (error.response?.status === 400) {
        const errorMsg = error.response.data;
        setTypeSelectionError(
          typeof errorMsg === "string"
            ? errorMsg
            : "We could not apply this change. Please try again."
        );
      } else {
        setTypeSelectionError("Unexpected error. Please try again.");
      }
    } finally {
      setIsSelectingType(false);
    }
  };

  const handleSelectType = async (type) => {
    if (!activeSlide || ![1, 2].includes(activeSlide.slide_type)) return;
    if (isSelectingType) return;

    const isContent = type === "Content Slide";
    const questionType = type === "Single Choice" ? "single" : "multiple";
    const quizId = quiz.quiz_id;
    const slideId = activeSlide.slide_id;
    const requestedMode = isContent ? "content" : type === "Single Choice" ? "single" : "multiple";
    try {
      setIsSelectingType(true);
      setTypeSelectionError(null);
      setTypeSelectionMode(requestedMode);

      const applyContentTypeChange = async () => {
        try {
          setIsSelectingType(true);
          const updatedSlide = await quizService.updateSlide(quizId, slideId, {
            ...activeSlide,
            slide_type: 2,
            question: null,
            title: activeSlide.title || "New content slide",
            content_text: activeSlide.content_text || "",
            content_image_url: activeSlide.content_image_url || "",
            show_leaderboard_after: false,
          });
          handleSlideUpdated(updatedSlide);
          setTypeSelectionNotice("Slide type set to Content.");
          setShowTypeBox(false);
          setShowSidebar(true);
          setShowDesignPanel(false);
          setShowAudioPanel(false);
          setActiveTab("content");
        } catch (error) {
          if (error.response?.status === 409 && error.response?.data?.error === "edit_conflict") {
            await refreshQuiz();
            setTypeSelectionError("This slide changed elsewhere. The latest version has been loaded.");
          } else if (error.response?.status === 409 && error.response?.data?.error === "slide_has_results") {
            setTypeSelectionError("This slide has live results. Reset the presentation results before changing its type.");
          } else {
            setTypeSelectionError("We could not convert this slide. Please try again.");
          }
        } finally {
          setIsSelectingType(false);
        }
      };

      if (isContent) {
        if (activeSlide.slide_type === 2) {
          setShowTypeBox(false);
          setShowSidebar(true);
          setActiveTab("content");
          return;
        }
        if (activeSlide.question) {
          setIsSelectingType(false);
          setConfirmDialog({
            isOpen: true,
            title: "Convert to a content slide?",
            description: "The question and its answer options will be replaced with content. Continue?",
            onConfirm: applyContentTypeChange,
            confirmText: "Convert",
            cancelText: "Cancel",
          });
          return;
        }
        await applyContentTypeChange();
        return;
      }

      const currentQuestion = activeSlide.question;

      if (activeSlide.slide_type === 2) {
        setIsSelectingType(false);
        setConfirmDialog({
          isOpen: true,
          title: "Convert to a question?",
          description: "The content slide will be replaced with a new question. Continue?",
          onConfirm: () => applyQuestionTypeChange({ currentQuestion: null, questionType, quizId, slideId, requestedMode }),
          confirmText: "Convert",
          cancelText: "Cancel",
        });
        return;
      }

      if (currentQuestion?.question_type === questionType) {
        setTypeSelectionNotice(
          `Question type is already ${requestedMode === "single" ? "Single Choice" : "Multiple Choice"}.`
        );
        setTimeout(() => {
          setTypeSelectionNotice(null);
        }, 2000);
        setShowTypeBox(false);
        setShowSidebar(true);
        setShowDesignPanel(false);
        setShowAudioPanel(false);
        setActiveTab("content");
        return;
      }

      if (currentQuestion?.question_type === "multiple" && questionType === "single") {
        setIsSelectingType(false);
        setConfirmDialog({
          isOpen: true,
          title: "Switch to Single Choice?",
          description:
            "Switching to single choice keeps only one correct option. Continue?",
          onConfirm: () => {
            applyQuestionTypeChange({
              currentQuestion,
              questionType,
              quizId,
              slideId,
              requestedMode,
            });
          },
          confirmText: "Continue",
          cancelText: "Cancel",
        });
        return;
      }

      await applyQuestionTypeChange({
        currentQuestion,
        questionType,
        quizId,
        slideId,
        requestedMode,
      });
    } catch (error) {
      console.error("Error resolving question type change:", error);
      setTypeSelectionError("Unexpected error. Please try again.");
    } finally {
      setIsSelectingType(false);
    }
  };



  // ???? ???? ??????????? ?????? ?? ?? ????? ?? Sidebar
  const handleSlideUpdated = (updatedSlide) => {
    // ??????????? ?????? ?? state ????
    const updatedSlides = slides.map((s) =>
      s.slide_id === updatedSlide.slide_id ? updatedSlide : s
    );

    updateQuiz({
      ...quiz,
      revision: quiz.revision + 1,
      slides: updatedSlides,
    });

    setActiveSlideId(updatedSlide.slide_id);
  };

  // Present
  // const handlePresent = () => {
  //   navigate(`/manager/presentation/${quiz.quiz_id}/`);
  // };


  const handlePresent = () => {
    if (!presentStatus.ready) {
      showNotice(presentStatus.reason, "warning");
      return;
    }
    navigate(`/manager/presentation/${quiz.quiz_id}/`);
  };

  // Calculate cumulative leaderboard for the current slide if it's a leaderboard slide







  return (
    <div
      className="relative flex h-full flex-col bg-gradient-to-b from-brand-soft to-canvas pb-20 pt-16 text-content md:pb-0"
      dir="rtl"
      style={{ fontFamily: '"Vazirmatn", "Segoe UI", sans-serif' }}
    >
      {/* ----- Header -----*/}
      <QuizHeader
        accessCode={quiz.access_code}
        quizTitle={quiz.title}
        quizId={quiz.quiz_id}
        quizRevision={quiz.revision}
        onNotify={showNotice}
        onBack={handleExitPanel}
        onQuizUpdated={updateQuiz}
        onAccessCodeSaved={(accessCode) => updateQuiz({ ...quiz, access_code: accessCode })}
        onConflict={refreshQuiz}
      />

      {/* ----- Main Layout ----- */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-3 md:flex-row md:p-4">
        {/* ----- Left Panel (Slides Panel) ----- */}
        {!isMobile && (
          <aside className="w-full max-h-[40vh] overflow-y-auto rounded-2xl border border-brand-border bg-surface p-4 shadow-sm md:h-full md:max-h-none md:w-1/4 lg:w-1/5">
            <SlidesPanel
              slides={slides}
              activeSlideId={activeSlide?.slide_id}
              setActiveSlideId={handleSetActiveSlideId}
              setActiveSlideTypeParent={setActiveSlideType}
              addNewSlide={addNewSlide}
              deleteSlide={deleteSlide}
              onSlidesReordered={(updatedSlides) => {
                updateQuiz({
                  ...quiz,
                  slides: updatedSlides,
                });
              }}
              onRefresh={handleDeleteLeaderboardAndRefresh}
              idKey="slide_id"
              titleKey="slide_type"
            getSlideTitle={getSlideTitle}
            quizId={quiz.quiz_id}
            presentationRevision={quiz.revision}
            quizBackground={quiz.background_color}
            quizBackgroundImage={quiz.background_image_url}
            onNotify={showNotice}
          />
        </aside>
        )}

        {/* ----- Middle panel ----- */}
        <main className="relative flex-1">
          <div className="relative flex h-full min-h-[520px] items-center justify-center overflow-hidden rounded-3xl border border-brand-border bg-surface p-3 shadow-sm">
            {/* ----- Present Button ----- */}
            <button
              onClick={handlePresent}
              disabled={!presentStatus.ready}
              title={presentStatus.reason}
              className="absolute left-3 top-3 z-10 rounded-control bg-brand px-4 py-2.5 text-sm font-bold text-content-inverse shadow-lg transition hover:bg-brand-strong
                        disabled:opacity-60 disabled:cursor-not-allowed"
            >
              اجرا
            </button>

            {(activeSlideType === 1 || activeSlideType === 2) && (
              <button
                onClick={handleTypeChangeClick}
                className="absolute right-3 top-3 z-10 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              >
                تغییر نوع اسلاید
              </button>
            )}

            
            {activeSlide ? (
              activeSlideType === 3 ? (
                <div className="w-full h-full flex justify-center items-center">
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    {leaderboardError && (
                      <div className="mb-2 text-sm text-danger">
                        {leaderboardError}
                      </div>
                    )}
                    {leaderboardLoading[activeSlide.slide_id] && (
                      <div className="text-sm text-slate-500 mb-2">
                        Loading leaderboard...
                      </div>
                    )}
                    {!leaderboardLoading[activeSlide.slide_id] &&
                      !leaderboardError &&
                      activeLeaderboardEntries.length === 0 && (
                        <div className="text-sm text-slate-500 mb-2">
                          No results yet. Run the quiz to see the leaderboard.
                        </div>
                      )}
                    <LeaderboardPreview
                      slide={activeSlide}
                      quizBackground={quiz.background_color}
                      quizBackgroundImage={quiz.background_image_url}
                      textColor={quiz.text_color}
                      isFullSize={
                        !showSidebar && !showDesignPanel && !showAudioPanel
                      }
                      customLeaderboard={
                        activeLeaderboardEntries
                      }
                    />
                  </div>
                </div>
              ) : activeSlideType === 2 ? (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-5 overflow-y-auto rounded-xl p-10 text-center"
                  style={{
                    color: quiz.text_color,
                    backgroundColor: quiz.background_color,
                    backgroundImage: quiz.background_image_url ? `url(${quiz.background_image_url})` : undefined,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                >
                  {activeSlide.content_image_url && (
                    <img src={activeSlide.content_image_url} alt="" className="max-h-[45%] max-w-[80%] rounded-xl object-contain" />
                  )}
                  <h2 className="text-3xl font-bold">{activeSlide.title || "Content slide"}</h2>
                  {activeSlide.content_text && <p className="max-w-3xl whitespace-pre-wrap text-lg">{activeSlide.content_text}</p>}
                </div>
              ) : activeSlideType === 1 && activeSlide.question ? (
                <div className="w-full h-full flex justify-center items-center">
                  <MiniResultsResultsOnly
                    slide={activeSlide}
                    quizBackground={quiz.background_color}
                    quizBackgroundImage={quiz.background_image_url}
                    textColor={quiz.text_color}
                    isFullSize={
                      !showSidebar && !showDesignPanel && !showAudioPanel
                    }
                  />
                </div>
              ) : (
                <div className="max-w-md text-center text-slate-500">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                    <Sparkles className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <h1 className="mt-5 text-xl font-black text-slate-900">نوع این اسلاید را انتخاب کنید</h1>
                  <p className="mb-5 mt-2 text-sm leading-7">سؤال تک‌گزینه‌ای، چندگزینه‌ای یا یک اسلاید محتوایی بسازید.</p>
                  <button
                    onClick={handleTypeChangeClick}
                    className="rounded-control bg-brand px-5 py-3 font-bold text-content-inverse hover:bg-brand-strong"
                  >
                    انتخاب نوع اسلاید
                  </button>
                </div>
              )
            ) : (
              <div className="mx-auto max-w-lg px-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                  <Sparkles className="h-8 w-8" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-bold text-brand">
                  {createdPresentation ? "ارائه شما آماده است" : "شروع یک ارائه تازه"}
                </p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">اولین اسلاید را بسازید</h1>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
                  با یک سؤال تعاملی یا اسلاید محتوایی شروع کنید. نوع اسلاید در مرحله بعد انتخاب می‌شود.
                </p>
                <button
                  type="button"
                  onClick={addNewSlide}
                  disabled={isAddingSlide}
                  autoFocus={createdPresentation}
                  className="mt-6 inline-flex items-center gap-2 rounded-control bg-brand px-6 py-3 font-bold text-content-inverse shadow-lg transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isAddingSlide ? (
                    <RefreshCw className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  )}
                  {isAddingSlide ? "در حال ساخت…" : "ساخت اولین اسلاید"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/manager/panel")}
                  className="mx-auto mt-4 flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  {fa.managerShell.backToDashboard}
                </button>
              </div>
            )}

            {showTypeBox && (
              <>
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"
                  onClick={() => setShowTypeBox(false)}
                ></div>

                <div className="absolute inset-x-3 z-20 mx-auto flex w-auto max-w-[440px] flex-col items-center space-y-4 rounded-3xl bg-white p-6 shadow-2xl sm:inset-x-auto sm:w-[440px]" role="dialog" aria-modal="true" aria-labelledby="slide-type-title">
                  <h2 id="slide-type-title" className="text-xl font-black text-brand-strong">
                    نوع اسلاید را انتخاب کنید
                  </h2>
                  <p className="text-sm text-slate-500 text-center">
                    بعداً می‌توانید نوع اسلاید را تغییر دهید.
                  </p>
                  {typeSelectionError && (
                    <Notice tone="error" className="w-full justify-center text-center">
                      {typeSelectionError}
                    </Notice>
                  )}

                  {["Single Choice", "Multiple Choice", "Content Slide"].map((type) => {
                    const isSingle = type === "Single Choice";
                    const isContent = type === "Content Slide";
                    const description = isContent ? "نمایش متن و تصویر بدون دریافت پاسخ" : isSingle
                      ? "یک پاسخ درست"
                      : "چند پاسخ درست";
                    const label = isContent ? "اسلاید محتوایی" : isSingle ? "تک‌گزینه‌ای" : "چندگزینه‌ای";
                    const isBusy =
                      isSelectingType &&
                      typeSelectionMode === (isContent ? "content" : isSingle ? "single" : "multiple");
                    return (
                      <button
                        key={type}
                        onClick={() => handleSelectType(type)}
                        disabled={isSelectingType}
                        className="w-full rounded-2xl border border-brand-border bg-brand-soft px-4 py-3 text-brand-ink transition hover:border-brand hover:bg-brand-muted disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex flex-col items-center">
                          <span className="font-semibold">
                            {isBusy ? "در حال اعمال…" : label}
                          </span>
                          <span className="text-xs text-brand">
                            {description}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setShowTypeBox(false)}
                    className="text-gray-500 text-sm hover:underline"
                  >
                    انصراف
                  </button>
                </div>
              </>
            )}
          </div>
          {typeSelectionNotice && (
            <Notice tone="success" className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 shadow-lg">
              {typeSelectionNotice}
            </Notice>
          )}
        </main>

        {/* ----- Right Panels ----- */}
        {showSidebar && (activeSlideType === 1 || activeSlideType === 2 || activeSlideType === 3) && (
          <div
            className="bg-white rounded-xl shadow p-4 overflow-y-auto w-full md:h-full md:w-1/3 lg:w-1/4 md:static fixed inset-x-0 bottom-0 top-14 z-50"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            {activeSlideType === 2 ? (
              <ContentSidebar
                quizId={quiz.quiz_id}
                slide={activeSlide}
                onClose={handleCloseSidebarPanel}
                onDirtyChange={setHasSidebarChanges}
                onSlideUpdated={handleSlideUpdated}
                onConflict={refreshQuiz}
                onNotify={showNotice}
              />
            ) : activeSlideType === 3 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                {/* ???? ???? ???? ???? */}
                <div className="w-full flex justify-end mb-4">
                  <button
                    onClick={handleCloseSidebarPanel}
                    className="rounded-lg p-2 transition-colors hover:bg-danger-soft"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                
                {/* ??? ?? ??? */}
                <div className="flex-grow flex items-center justify-center">
                  <p className="text-gray-700 font-medium text-2xl mb-30">
                    This slide does not require any additional settings.
                  </p>
                </div>
              </div>
            ) : (
              (() => {
                // ????? ????? ??? activeSlide.question ???? ????
                if (!activeSlide?.question) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <div className="text-yellow-500 mb-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-700 font-medium">
                        First, select the question type.
                      </p>
                      <button
                        onClick={handleTypeChangeClick}
                        className="mt-4 rounded-control bg-brand px-4 py-2 text-content-inverse transition hover:bg-brand-strong"
                      >
                        Select Type
                      </button>
                    </div>
                  );
                }

                const validQuestionTypes = ["single", "multiple"];

                if (
                  !activeSlide.question.question_type ||
                  !validQuestionTypes.includes(activeSlide.question.question_type)
                ) {
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <div className="mb-2 text-danger">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-700 font-medium">
                        Question type is invalid.
                      </p>
                    </div>
                  );
                }

                // ??? ??? ????? ?????? ???? ???????? Sidebar ?? ???? ??
                return (
                    <Sidebar
                      quizId={quiz.quiz_id}
                      slide={activeSlide}
                      activeSlideType={activeSlideType}
                      onClose={handleCloseSidebarPanel}
                      onDirtyChange={setHasSidebarChanges}
                      onSlideUpdated={handleSlideUpdated}
                      onConflict={refreshQuiz}
                      onNotify={showNotice}
                  />
                );
              })()
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------------------------------------- */}
        
        {showDesignPanel && (
          <div
            className="bg-white rounded-xl shadow p-4 overflow-y-auto w-full md:h-full md:w-1/3 lg:w-1/4 md:static fixed inset-x-0 bottom-0 top-14 z-50"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            {activeSlide && (
              <DesignPanel
                quiz={quiz}
                updateQuiz={updateQuiz}
                onClose={handleCloseDesignPanel}
                setBackgroundSaveNotice={setBackgroundSaveNotice}
                onDirtyChange={setHasDesignChanges}
                onConflict={refreshQuiz}
              />
            )}
          </div>
        )}

        {backgroundSaveNotice && (
          <Notice tone="success" className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 shadow-lg">
            {backgroundSaveNotice}
          </Notice>
        )}

        {showAudioPanel && (
          <div
            className="bg-white rounded-xl shadow p-4 overflow-y-auto w-full md:h-full md:w-1/3 lg:w-1/4 md:static fixed inset-x-0 bottom-0 top-14 z-50"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            {activeSlide && (
              <AudioPanel
                slide={activeSlide}
                onClose={handleCloseAudioPanel}
                quiz={quiz}
                updateQuiz={updateQuiz}
                setAudioSaveNotice={setAudioSaveNotice}
                onDirtyChange={setHasAudioChanges}
                onConflict={refreshQuiz}
              />
            )}
          </div>
        )}

        {audioSaveNotice && (
          <Notice tone="success" className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 shadow-lg">
            {audioSaveNotice}
          </Notice>
        )}

        {/* ----- RightToolbar ----- */}
        <RightToolbar
          activeTab={activeTab}
          setActiveTab={handleTabClick}
          isCompact={isMobile}
          // hasQuestion={activeSlide?.slide_type === 1}
        />
      </div>
      {isMobile && showSlidesPanel && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowSlidesPanel(false)}
          ></div>
          <div
            className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-2xl p-4 overflow-y-auto"
            style={{
              top: "calc(3.5rem + env(safe-area-inset-top))",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-800">اسلایدها</h2>
              <button
                onClick={() => setShowSlidesPanel(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <SlidesPanel
              slides={slides}
              activeSlideId={activeSlide?.slide_id}
              setActiveSlideId={(id) => {
                handleSetActiveSlideIdForMobile(id);
              }}
              setActiveSlideTypeParent={setActiveSlideType}
              addNewSlide={addNewSlide}
              deleteSlide={deleteSlide}
              onSlidesReordered={(updatedSlides) => {
                updateQuiz({
                  ...quiz,
                  slides: updatedSlides,
                });
              }}
              onRefresh={handleDeleteLeaderboardAndRefresh}
              idKey="slide_id"
              titleKey="slide_type"
              getSlideTitle={getSlideTitle}
              quizId={quiz.quiz_id}
              presentationRevision={quiz.revision}
              quizBackground={quiz.background_color}
              quizBackgroundImage={quiz.background_image_url}
              onNotify={showNotice}
            />
          </div>
        </div>
      )}
      {notice && (
        <div
          className="fixed left-1/2 z-50 -translate-x-1/2 px-4"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <Notice tone={notice.tone} pending={notice.pending} className="shadow-lg">
            {notice.message}
          </Notice>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmVariant="destructive"
        isLoading={false}
      />
    </div>
  );
}
