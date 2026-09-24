import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation, useNavigation } from "react-router-dom";
import QuestionCanvas from "../canvas/QuestionCanvas";
import ContentCanvas from "../canvas/ContentCanvas";
import LeaderboardPreview from "../canvas/LeaderboardCanvas";
import QuizHeader from "../toolbar/EditorHeader.tsx";
import Sidebar from "../inspector/QuestionInspector";
import SlidesPanel from "../slide-list/SlideList.tsx";
import RightToolbar from "../toolbar/EditorToolbar.tsx";
import DesignPanel from "../inspector/DesignInspector";
import AudioPanel from "../inspector/AudioInspector.tsx";
import ContentSidebar from "../inspector/ContentInspector";
import { quizService } from "../../api/presentationRepository.ts";
import { getPresentationValidationError, type EditorPresentation } from "../../model/editor.ts";
import { X, ArrowRight, Plus, RefreshCw, Sparkles } from "lucide-react";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import EditorRouteSkeleton from "./EditorRouteSkeleton";
import Notice from "../../../../shared/ui/Notice";
import { fa } from "../../../../shared/i18n/fa";
import { useEditorStatus } from "../model/useEditorStatus.ts";
import QuestionDraftProvider from "../model/QuestionDraftProvider.tsx";
import ContentDraftProvider from "../model/ContentDraftProvider.tsx";
import DesignDraftProvider from "../model/DesignDraftProvider.tsx";
import { useEditorNotice } from "../model/useEditorNotice.ts";
import { useEditorPanelController } from "../model/useEditorPanelController.ts";
import { useEditorViewport } from "../model/useEditorViewport.ts";
import { useUnsavedChangesGuard } from "../model/useUnsavedChangesGuard.ts";
import { useEditorSlideMutations } from "../model/useEditorSlideMutations.ts";
import { useEditorSlideOrder } from "../model/useEditorSlideOrder.ts";
import { useEditorSlideSelection } from "../model/useEditorSlideSelection.ts";

type EditorRouteLocationState = {
  createdPresentation?: boolean;
};

type LeaderboardEntry =
  Awaited<ReturnType<typeof quizService.getQuestionLeaderboard>>[number];

type QuestionEditorProps = {
  quiz: EditorPresentation;
  updateQuiz: (quiz: EditorPresentation) => void;
  refreshQuiz: () => Promise<void>;
  createdPresentation: boolean;
};

const SLIDE_TYPE_CHOICES = [
  "Single Choice",
  "Multiple Choice",
  "Content Slide",
] as const;


export default function EditorPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const quizId = roomId?.trim() || "";

  const [quiz, setQuiz] = useState<EditorPresentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchSequenceRef = useRef(0);
  const routeLoadAbortRef = useRef<AbortController | null>(null);
  const interruptedRouteLoadRef = useRef(false);
  const interruptedPageHideLoadRef = useRef(false);

  const fetchQuiz = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++fetchSequenceRef.current;
    if (!quizId) {
      setError("ارائه‌ای وجود ندارد.");
      setLoading(false);
      return;
    }

    try {
      const quizData = await quizService.getEditorQuiz(quizId, { signal });
      if (signal?.aborted || sequence !== fetchSequenceRef.current) return;
      setQuiz(quizData);
      setError(null);
    } catch (err) {
      if (signal?.aborted || sequence !== fetchSequenceRef.current) return;
      setError("بارگذاری ارائه انجام نشد");
      console.error(err);
    } finally {
      if (!signal?.aborted && sequence === fetchSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [quizId]);

  const runQuizLoad = useCallback(
    async (showLoading: boolean): Promise<void> => {
      const controller = new AbortController();
      routeLoadAbortRef.current?.abort();
      routeLoadAbortRef.current = controller;
      if (showLoading) setLoading(true);

      try {
        await fetchQuiz(controller.signal);
      } finally {
        if (routeLoadAbortRef.current === controller) {
          routeLoadAbortRef.current = null;
        }
      }
    },
    [fetchQuiz],
  );

  const startRouteLoad = useCallback(() => {
    void runQuizLoad(true);
  }, [runQuizLoad]);

  const refreshQuiz = useCallback(
    () => runQuizLoad(false),
    [runQuizLoad],
  );

  useEffect(() => {
    interruptedRouteLoadRef.current = false;
    startRouteLoad();

    return () => {
      routeLoadAbortRef.current?.abort();
      routeLoadAbortRef.current = null;
      interruptedRouteLoadRef.current = false;
      fetchSequenceRef.current += 1;
    };
  }, [startRouteLoad]);

  useEffect(() => {
    const handlePageHide = () => {
      const controller = routeLoadAbortRef.current;
      if (!controller || controller.signal.aborted) {
        interruptedPageHideLoadRef.current = false;
        return;
      }

      interruptedPageHideLoadRef.current = true;
      controller.abort();
      fetchSequenceRef.current += 1;
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !interruptedPageHideLoadRef.current) return;

      interruptedPageHideLoadRef.current = false;
      startRouteLoad();
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      interruptedPageHideLoadRef.current = false;
    };
  }, [startRouteLoad]);

  useEffect(() => {
    const nextPath = navigation.location?.pathname;

    if (
      navigation.state !== "idle" &&
      nextPath &&
      nextPath !== location.pathname
    ) {
      const controller = routeLoadAbortRef.current;
      if (controller && !controller.signal.aborted) {
        interruptedRouteLoadRef.current = true;
        controller.abort();
      }
      return;
    }

    if (
      navigation.state === "idle" &&
      interruptedRouteLoadRef.current
    ) {
      interruptedRouteLoadRef.current = false;
      startRouteLoad();
    }
  }, [
    location.pathname,
    navigation.location?.pathname,
    navigation.state,
    startRouteLoad,
  ]);

  const updateQuiz = (updatedQuiz: EditorPresentation) => {
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
            <button type="button" onClick={startRouteLoad} className="rounded-control bg-brand px-5 py-3 font-bold text-content-inverse hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
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
      refreshQuiz={refreshQuiz}
      createdPresentation={(location.state as EditorRouteLocationState | null)?.createdPresentation === true}
    />
  );
}


function QuestionEditor({ quiz, updateQuiz, refreshQuiz, createdPresentation }: QuestionEditorProps) {

  const navigate = useNavigate();
  const [leaderboardPreviewData, setLeaderboardPreviewData] = useState<Record<string, LeaderboardEntry[]>>({});
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState<Record<string, boolean>>({});
  const editorStatus = useEditorStatus();
  const hasSidebarChanges = editorStatus.dirty.content;
  const hasAudioChanges = editorStatus.dirty.audio;
  const hasDesignChanges = editorStatus.dirty.design;
  const setHasSidebarChanges = useCallback(
    (dirty: boolean) => editorStatus.setDirty("content", Boolean(dirty)),
    [editorStatus],
  );
  const setHasAudioChanges = useCallback(
    (dirty: boolean) => editorStatus.setDirty("audio", Boolean(dirty)),
    [editorStatus],
  );
  const setHasDesignChanges = useCallback(
    (dirty: boolean) => editorStatus.setDirty("design", Boolean(dirty)),
    [editorStatus],
  );
  const hasUnsavedChanges = editorStatus.hasUnsavedChanges;
  const { notice, showNotice } = useEditorNotice();

  const slides = quiz.slides;
  const presentStatus = (() => {
    if (hasUnsavedChanges) {
      return { ready: false, reason: "پیش از اجرا، تغییرات را ذخیره یا رها کنید." };
    }
    const validationError = getPresentationValidationError(quiz);
    if (validationError) return { ready: false, reason: validationError };
    return { ready: true, reason: "شروع ارائه" };
  })();

  const panels = useEditorPanelController({
    dirty: {
      content: hasSidebarChanges,
      audio: hasAudioChanges,
      design: hasDesignChanges,
    },
    discard: {
      content: () => setHasSidebarChanges(false),
      audio: () => setHasAudioChanges(false),
      design: () => setHasDesignChanges(false),
    },
  });
  const {
    activeTab,
    showSidebar,
    showDesignPanel,
    showAudioPanel,
    showSlidesPanel,
    confirmDialog,
  } = panels;

  const selection = useEditorSlideSelection({
    slides,
    hasContentChanges: hasSidebarChanges,
    discardContentChanges: () => setHasSidebarChanges(false),
    closeSlidesPanel: () => panels.closePanel("slides"),
    requestConfirmation: panels.requestConfirmation,
  });
  const {
    activeSlide,
    activeSlideId,
    activeSlideType,
  } = selection;
  const activeLeaderboardEntries = activeSlide?.slide_id
    ? leaderboardPreviewData[activeSlide.slide_id] || []
    : [];

  const recoverConflict = useCallback(async () => {
    const message = "نسخه جدیدتری روی سرور وجود داشت؛ آخرین نسخه بارگذاری شد.";
    editorStatus.reportConflict(message);
    await refreshQuiz();
  }, [editorStatus, refreshQuiz]);

  const slideMutations = useEditorSlideMutations({
    presentation: quiz,
    activeSlide,
    updatePresentation: updateQuiz,
    refreshPresentation: refreshQuiz,
    selectSlide: selection.selectSlideImmediate,
    activateContentPanel: () => panels.activateTab("content"),
    closeSlidesPanel: () => panels.closePanel("slides"),
    recoverConflict,
    showNotice,
    requestConfirmation: panels.requestConfirmation,
  });
  const {
    showTypeBox,
    isSelectingType,
    isAddingSlide,
    typeSelectionError,
    typeSelectionNotice,
    typeSelectionMode,
  } = slideMutations;

  const slideOrder = useEditorSlideOrder({
    presentation: quiz,
    updatePresentation: updateQuiz,
    refreshPresentation: refreshQuiz,
    recoverConflict,
    showNotice,
    disabled: hasUnsavedChanges,
  });

  useUnsavedChangesGuard(hasUnsavedChanges);
  const isMobile = useEditorViewport(panels.overlayOpen || showTypeBox);

  const reloadAudioConflict = useCallback(async () => {
    await refreshQuiz();
    editorStatus.clearConflict();
  }, [editorStatus, refreshQuiz]);

  const loadLeaderboardPreview = useCallback(async (slideId: string) => {
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


  const handleTabClick = panels.toggleTab;

  const handleConfirm = panels.confirmPendingAction;
  const handleCancel = panels.closeConfirmDialog;

  const handleExitPanel = () => {
    if (!hasUnsavedChanges) {
      navigate("/manager/panel");
      return;
    }

    panels.requestConfirmation(() => {
      setHasSidebarChanges(false);
      setHasAudioChanges(false);
      setHasDesignChanges(false);
      navigate("/manager/panel");
    }, {
      title: "خروج از ویرایشگر؟",
      description: "تغییرات ذخیره‌نشده‌ای دارید. آن‌ها را کنار بگذارید؟",
    });
  };

  const handleCloseAudioPanel = () => panels.closePanel("audio");
  const handleCloseDesignPanel = () => panels.closePanel("design");

  const handleCloseSidebarPanel = (forceClose = false) => {
    const close = () => {
      setHasSidebarChanges(false);
      panels.closePanel("content");
    };

    if (!forceClose && hasSidebarChanges) {
      panels.requestConfirmation(close);
      return;
    }

    close();
  };

  const addNewSlide = slideMutations.beginAddSlide;
  const deleteSlide = slideMutations.deleteSlide;

  const handleTypeChangeClick = () => {
    if (isSelectingType) return;

    const openTypeSelection = () => {
      setHasSidebarChanges(false);
      handleCloseSidebarPanel(true);
      slideMutations.openTypeSelection();
    };

    if (hasSidebarChanges) {
      panels.requestConfirmation(openTypeSelection, {
        title: "تغییر نوع سؤال",
        description:
          "تغییرات ذخیره‌نشده‌ای دارید. پیش از تغییر نوع سؤال آن‌ها را کنار بگذارید؟",
      });
      return;
    }

    slideMutations.openTypeSelection();
  };

  const cancelTypeSelection = slideMutations.cancelTypeSelection;
  const handleSelectType = slideMutations.selectType;
  const handleSlideUpdated = slideMutations.applyUpdatedSlide;

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
    <DesignDraftProvider
      presentation={showDesignPanel ? quiz : null}
    >
    <QuestionDraftProvider
      slide={showSidebar && activeSlideType === 1 ? activeSlide : null}
    >
    <ContentDraftProvider
      slide={showSidebar && activeSlideType === 2 ? activeSlide : null}
    >
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
        onAccessCodeSaved={(accessCode: string) => updateQuiz({ ...quiz, access_code: accessCode })}
        onConflict={recoverConflict}
        saveState={editorStatus.saveState}
      />

      {/* ----- Main Layout ----- */}
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-3 md:flex-row md:p-4">
        {/* ----- Left Panel (Slides Panel) ----- */}
        {!isMobile && (
          <aside className="w-full max-h-[40vh] overflow-y-auto rounded-2xl border border-brand-border bg-surface p-4 shadow-sm md:h-full md:max-h-none md:w-1/4 lg:w-1/5">
            <SlidesPanel
              slides={slideOrder.orderedSlides}
              activeSlideId={activeSlideId}
              activeSlideType={activeSlideType}
              onSelectSlide={(slideId, slideType) =>
                selection.requestSlideSelection(slideId, slideType)
              }
              addNewSlide={addNewSlide}
              deleteSlide={deleteSlide}
              deleteLeaderboardSlide={slideMutations.deleteLeaderboardSlide}
              quizBackground={quiz.background_color}
              quizBackgroundImage={quiz.background_image_url}
              isReordering={slideOrder.isReordering}
              reorderDisabled={hasUnsavedChanges}
              onReorder={slideOrder.reorderSlides}
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
                        در حال بارگذاری جدول امتیازات…
                      </div>
                    )}
                    {!leaderboardLoading[activeSlide.slide_id] &&
                      !leaderboardError &&
                      activeLeaderboardEntries.length === 0 && (
                        <div className="text-sm text-slate-500 mb-2">
                          هنوز نتیجه‌ای نیست. برای دیدن جدول امتیازات، کوئیز را اجرا کنید.
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
                <div className="flex h-full w-full items-center justify-center">
                  <ContentCanvas
                    slide={activeSlide}
                    quizBackground={quiz.background_color}
                    quizBackgroundImage={quiz.background_image_url}
                    textColor={quiz.text_color}
                  />
                </div>
              ) : activeSlideType === 1 && activeSlide.question ? (
                <div className="w-full h-full flex justify-center items-center">
                  <QuestionCanvas
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
                  onClick={cancelTypeSelection}
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

                  {SLIDE_TYPE_CHOICES.map((type) => {
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
                    onClick={cancelTypeSelection}
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
                onConflict={recoverConflict}
                onNotify={showNotice}
              />
            ) : activeSlideType === 3 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                {/* ???? ???? ???? ???? */}
                <div className="w-full flex justify-end mb-4">
                  <button
                    onClick={() => handleCloseSidebarPanel()}
                    className="rounded-lg p-2 transition-colors hover:bg-danger-soft"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                
                {/* ??? ?? ??? */}
                <div className="flex-grow flex items-center justify-center">
                  <p className="text-gray-700 font-medium text-2xl mb-30">
این اسلاید به تنظیمات اضافه نیاز ندارد.
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
                        ابتدا نوع سؤال را انتخاب کنید.
                      </p>
                      <button
                        onClick={handleTypeChangeClick}
                        className="mt-4 rounded-control bg-brand px-4 py-2 text-content-inverse transition hover:bg-brand-strong"
                      >
                        انتخاب نوع
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
                        نوع سؤال نامعتبر است.
                      </p>
                    </div>
                  );
                }

                // ??? ??? ????? ?????? ???? ???????? Sidebar ?? ???? ??
                return (
                    <Sidebar
                      quizId={quiz.quiz_id}
                      slide={activeSlide}
                      onClose={handleCloseSidebarPanel}
                      onDirtyChange={setHasSidebarChanges}
                      onSlideUpdated={handleSlideUpdated}
                      onConflict={recoverConflict}
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
            className="fixed inset-x-0 bottom-0 top-14 z-50 w-full overflow-y-auto rounded-xl bg-surface p-4 shadow md:static md:h-full md:w-1/3 lg:w-1/4"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            <DesignPanel
              quizId={quiz.quiz_id}
              onClose={handleCloseDesignPanel}
              onQuizUpdated={updateQuiz}
              onDirtyChange={setHasDesignChanges}
              onConflict={recoverConflict}
              onNotify={showNotice}
            />
          </div>
        )}

        {showAudioPanel && (
          <div
            className="fixed inset-x-0 bottom-0 top-14 z-50 w-full overflow-y-auto rounded-panel border border-border-subtle bg-surface p-4 shadow-panel md:static md:h-full md:w-1/3 lg:w-1/4"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            <AudioPanel
              onClose={handleCloseAudioPanel}
              quiz={quiz}
              onQuizUpdated={updateQuiz}
              onDirtyChange={setHasAudioChanges}
              onConflict={reloadAudioConflict}
              onNotify={showNotice}
            />
          </div>
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
            onClick={() => panels.closePanel("slides")}
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
                onClick={() => panels.closePanel("slides")}
                className="p-2 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <SlidesPanel
              slides={slideOrder.orderedSlides}
              activeSlideId={activeSlideId}
              activeSlideType={activeSlideType}
              onSelectSlide={(slideId, slideType) =>
                selection.requestSlideSelection(
                  slideId,
                  slideType,
                  true,
                )
              }
              addNewSlide={addNewSlide}
              deleteSlide={deleteSlide}
              deleteLeaderboardSlide={slideMutations.deleteLeaderboardSlide}
              quizBackground={quiz.background_color}
              quizBackgroundImage={quiz.background_image_url}
              isReordering={slideOrder.isReordering}
              reorderDisabled={hasUnsavedChanges}
              onReorder={slideOrder.reorderSlides}
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
      {editorStatus.conflictMessage && (
        <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-xl">
          <Notice
            tone="warning"
            className="shadow-lg"
            action={(
              <button
                type="button"
                onClick={async () => {
                  await refreshQuiz();
                  editorStatus.clearConflict();
                }}
                className="rounded-control border border-warning-border px-3 py-1.5 text-xs font-bold hover:bg-warning-soft"
              >
                بارگذاری دوباره
              </button>
            )}
          >
            {editorStatus.conflictMessage}
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
    </ContentDraftProvider>
    </QuestionDraftProvider>
    </DesignDraftProvider>
  );
}
