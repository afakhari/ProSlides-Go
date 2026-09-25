import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation, useNavigation } from "react-router-dom";
import QuizHeader from "../toolbar/EditorHeader.tsx";
import SlidesPanel from "../slide-list/SlideList.tsx";
import RightToolbar from "../toolbar/EditorToolbar.tsx";
import DesignPanel from "../inspector/DesignInspector";
import AudioPanel from "../inspector/AudioInspector.tsx";
import { quizService } from "../../api/presentationRepository.ts";
import type { EditorPresentation } from "../../model/editor.ts";
import {
  getPresentationValidationError,
  resolveEditorItemRegistration,
} from "../../model/itemRegistry.ts";
import {
  editorTypeChoices,
} from "../registry/editorItemRegistry.ts";
import {
  EditorItemCanvas,
  EditorItemDraftBoundary,
  EditorItemInspector,
} from "../registry/editorItemRenderRegistry.tsx";
import EditorShell from "../shell/EditorShell.tsx";
import { X, ArrowRight, Plus, RefreshCw, Sparkles } from "lucide-react";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import EditorRouteSkeleton from "./EditorRouteSkeleton";
import Notice from "../../../../shared/ui/Notice";
import { fa } from "../../../../shared/i18n/fa";
import { useEditorStatus } from "../model/useEditorStatus.ts";
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

type QuestionEditorProps = {
  quiz: EditorPresentation;
  updateQuiz: (quiz: EditorPresentation) => void;
  refreshQuiz: () => Promise<void>;
  createdPresentation: boolean;
};

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
  const interruptedPageHideLoadRef = useRef<boolean | null>(null);
  const activeLoadShowsSkeletonRef = useRef(false);

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
      activeLoadShowsSkeletonRef.current = showLoading;
      if (showLoading) setLoading(true);

      try {
        await fetchQuiz(controller.signal);
      } finally {
        if (routeLoadAbortRef.current === controller) {
          routeLoadAbortRef.current = null;
          activeLoadShowsSkeletonRef.current = false;
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
        interruptedPageHideLoadRef.current = null;
        return;
      }

      interruptedPageHideLoadRef.current = activeLoadShowsSkeletonRef.current;
      controller.abort();
      fetchSequenceRef.current += 1;
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      const resumeWithLoading = interruptedPageHideLoadRef.current;
      if (!event.persisted || resumeWithLoading === null) return;

      interruptedPageHideLoadRef.current = null;
      void runQuizLoad(resumeWithLoading);
    };

    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      interruptedPageHideLoadRef.current = null;
    };
  }, [runQuizLoad]);

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


function QuestionEditor({
  quiz,
  updateQuiz,
  refreshQuiz,
  createdPresentation,
}: QuestionEditorProps) {
  const navigate = useNavigate();
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

  const presentStatus = (() => {
    if (hasUnsavedChanges) {
      return {
        ready: false,
        reason: "پیش از اجرا، تغییرات را ذخیره یا رها کنید.",
      };
    }
    const validationError = getPresentationValidationError(quiz);
    if (validationError) {
      return { ready: false, reason: validationError };
    }
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
    slides: quiz.slides,
    hasContentChanges: hasSidebarChanges,
    discardContentChanges: () => setHasSidebarChanges(false),
    closeSlidesPanel: () => panels.closePanel("slides"),
    requestConfirmation: panels.requestConfirmation,
  });
  const { activeSlide, activeSlideId } = selection;
  const activeRegistration = resolveEditorItemRegistration(activeSlide);
  const activeItemConfigured =
    Boolean(activeSlide) &&
    Boolean(activeRegistration?.isConfigured(activeSlide!));

  const recoverConflict = useCallback(async () => {
    editorStatus.reportConflict(
      "نسخه جدیدتری روی سرور وجود داشت؛ آخرین نسخه بارگذاری شد.",
    );
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
  const isMobile = useEditorViewport(
    panels.overlayOpen || showTypeBox,
  );

  const reloadAudioConflict = useCallback(async () => {
    await refreshQuiz();
    editorStatus.clearConflict();
  }, [editorStatus, refreshQuiz]);

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

  const handleTypeChangeClick = () => {
    if (isSelectingType) return;

    const openTypeSelection = () => {
      setHasSidebarChanges(false);
      handleCloseSidebarPanel(true);
      slideMutations.openTypeSelection();
    };

    if (hasSidebarChanges) {
      panels.requestConfirmation(openTypeSelection, {
        title: "تغییر نوع آیتم",
        description:
          "تغییرات ذخیره‌نشده‌ای دارید. پیش از تغییر نوع آیتم آن‌ها را کنار بگذارید؟",
      });
      return;
    }

    slideMutations.openTypeSelection();
  };

  const handlePresent = () => {
    if (!presentStatus.ready) {
      showNotice(presentStatus.reason, "warning");
      return;
    }
    navigate(`/manager/presentation/${quiz.quiz_id}/`);
  };

  const itemRail = (
    <SlidesPanel
      slides={slideOrder.orderedSlides}
      activeSlideId={activeSlideId}
      onSelectSlide={(slideId) =>
        selection.requestSlideSelection(slideId)
      }
      addNewSlide={slideMutations.beginAddSlide}
      deleteSlide={slideMutations.deleteSlide}
      quizBackground={quiz.background_color}
      quizBackgroundImage={quiz.background_image_url}
      isReordering={slideOrder.isReordering}
      reorderDisabled={hasUnsavedChanges}
      onReorder={slideOrder.reorderSlides}
    />
  );

  const editorCanvas = activeSlide ? (
    activeItemConfigured || activeRegistration?.category === "legacy" ? (
      <div className="flex h-full w-full items-center justify-center">
        <EditorItemCanvas
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
        <h1 className="mt-5 text-xl font-black text-slate-900">
          نوع این آیتم را انتخاب کنید
        </h1>
        <p className="mb-5 mt-2 text-sm leading-7">
          یک فعالیت انتخابی یا اسلاید محتوایی بسازید. رفتار نتیجه و
          رتبه‌بندی، بخشی از تنظیمات Activity است و آیتم جداگانه نیست.
        </p>
        <button
          type="button"
          onClick={handleTypeChangeClick}
          className="rounded-control bg-brand px-5 py-3 font-bold text-content-inverse hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          انتخاب نوع آیتم
        </button>
      </div>
    )
  ) : (
    <div className="mx-auto max-w-lg px-5 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-muted text-brand">
        <Sparkles className="h-8 w-8" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-bold text-brand">
        {createdPresentation
          ? "ارائه شما آماده است"
          : "شروع یک ارائه تازه"}
      </p>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        اولین آیتم را بسازید
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
        با یک فعالیت تعاملی یا اسلاید محتوایی شروع کنید. نوع آیتم در مرحله
        بعد انتخاب می‌شود.
      </p>
      <button
        type="button"
        onClick={slideMutations.beginAddSlide}
        disabled={isAddingSlide}
        autoFocus={createdPresentation}
        className="mt-6 inline-flex items-center gap-2 rounded-control bg-brand px-6 py-3 font-bold text-content-inverse shadow-lg transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isAddingSlide ? (
          <RefreshCw
            className="h-5 w-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Plus className="h-5 w-5" aria-hidden="true" />
        )}
        {isAddingSlide ? "در حال ساخت…" : "ساخت اولین آیتم"}
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
  );

  const typePicker = showTypeBox ? (
    <>
      <button
        type="button"
        aria-label="بستن انتخاب نوع آیتم"
        className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={slideMutations.cancelTypeSelection}
      />
      <div
        className="absolute inset-x-3 z-40 mx-auto flex w-auto max-w-[440px] flex-col items-center space-y-4 rounded-3xl bg-white p-6 shadow-2xl sm:inset-x-auto sm:w-[440px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-type-title"
      >
        <h2
          id="item-type-title"
          className="text-xl font-black text-brand-strong"
        >
          نوع آیتم را انتخاب کنید
        </h2>
        <p className="text-center text-sm text-slate-500">
          نوع آیتم را بعداً هم می‌توانید تغییر دهید. تبدیل نوع ممکن است
          محتوای مخصوص نوع قبلی را جایگزین کند.
        </p>

        {typeSelectionError && (
          <Notice
            tone="error"
            className="w-full justify-center text-center"
          >
            {typeSelectionError}
          </Notice>
        )}

        {editorTypeChoices.map((choice) => {
          const isBusy =
            isSelectingType && typeSelectionMode === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => void slideMutations.selectType(choice.id)}
              disabled={isSelectingType}
              className="w-full rounded-2xl border border-brand-border bg-brand-soft px-4 py-3 text-brand-ink transition hover:border-brand hover:bg-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex flex-col items-center">
                <span className="font-semibold">
                  {isBusy ? "در حال اعمال…" : choice.label}
                </span>
                <span className="text-xs leading-5 text-brand">
                  {choice.description}
                </span>
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={slideMutations.cancelTypeSelection}
          className="min-h-10 rounded-lg px-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800"
        >
          انصراف
        </button>
      </div>
    </>
  ) : null;

  const itemInspector =
    showSidebar && activeSlide ? (
      activeItemConfigured ||
      activeRegistration?.category === "legacy" ? (
        <EditorItemInspector
          quizId={quiz.quiz_id}
          slide={activeSlide}
          onClose={handleCloseSidebarPanel}
          onDirtyChange={setHasSidebarChanges}
          onSlideUpdated={slideMutations.applyUpdatedSlide}
          onConflict={recoverConflict}
          onNotify={showNotice}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
          <div className="rounded-2xl bg-warning-soft p-4 text-warning-ink">
            <Sparkles className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="mt-4 font-medium text-gray-700">
            برای ویرایش، ابتدا نوع این آیتم را انتخاب کنید.
          </p>
          <button
            type="button"
            onClick={handleTypeChangeClick}
            className="mt-4 rounded-control bg-brand px-4 py-2 font-bold text-content-inverse hover:bg-brand-strong"
          >
            انتخاب نوع آیتم
          </button>
        </div>
      )
    ) : showDesignPanel ? (
      <DesignPanel
        quizId={quiz.quiz_id}
        onClose={() => panels.closePanel("design")}
        onQuizUpdated={updateQuiz}
        onDirtyChange={setHasDesignChanges}
        onConflict={recoverConflict}
        onNotify={showNotice}
      />
    ) : showAudioPanel ? (
      <AudioPanel
        onClose={() => panels.closePanel("audio")}
        quiz={quiz}
        onQuizUpdated={updateQuiz}
        onDirtyChange={setHasAudioChanges}
        onConflict={reloadAudioConflict}
        onNotify={showNotice}
      />
    ) : null;

  const topActions = (
    <>
      {activeSlide && activeRegistration?.category !== "legacy" ? (
        <button
          type="button"
          onClick={handleTypeChangeClick}
          className="pointer-events-auto rounded-lg bg-surface/90 px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          تغییر نوع آیتم
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={handlePresent}
        disabled={!presentStatus.ready}
        title={presentStatus.reason}
        className="pointer-events-auto rounded-control bg-brand px-4 py-2.5 text-sm font-bold text-content-inverse shadow-lg transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
      >
        اجرا
      </button>
    </>
  );

  const mobileItemRail =
    isMobile && showSlidesPanel ? (
      <div className="fixed inset-0 z-50 md:hidden">
        <button
          type="button"
          aria-label="بستن فهرست آیتم‌ها"
          className="absolute inset-0 bg-black/40"
          onClick={() => panels.closePanel("slides")}
        />
        <div
          className="absolute inset-x-0 bottom-0 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl"
          style={{
            top: "calc(3.5rem + env(safe-area-inset-top))",
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">آیتم‌ها</h2>
            <button
              type="button"
              aria-label="بستن فهرست آیتم‌ها"
              onClick={() => panels.closePanel("slides")}
              className="rounded-lg p-2 transition hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" aria-hidden="true" />
            </button>
          </div>
          <SlidesPanel
            slides={slideOrder.orderedSlides}
            activeSlideId={activeSlideId}
            onSelectSlide={(slideId) =>
              selection.requestSlideSelection(slideId, true)
            }
            addNewSlide={slideMutations.beginAddSlide}
            deleteSlide={slideMutations.deleteSlide}
            quizBackground={quiz.background_color}
            quizBackgroundImage={quiz.background_image_url}
            isReordering={slideOrder.isReordering}
            reorderDisabled={hasUnsavedChanges}
            onReorder={slideOrder.reorderSlides}
          />
        </div>
      </div>
    ) : null;

  return (
    <DesignDraftProvider presentation={showDesignPanel ? quiz : null}>
      <EditorItemDraftBoundary
        slide={activeSlide}
        active={showSidebar && activeItemConfigured}
      >
        <EditorShell
          isMobile={isMobile}
          header={(
            <QuizHeader
              accessCode={quiz.access_code}
              quizTitle={quiz.title}
              quizId={quiz.quiz_id}
              quizRevision={quiz.revision}
              onNotify={showNotice}
              onBack={handleExitPanel}
              onQuizUpdated={updateQuiz}
              onAccessCodeSaved={(accessCode: string) =>
                updateQuiz({ ...quiz, access_code: accessCode })
              }
              onConflict={recoverConflict}
              saveState={editorStatus.saveState}
            />
          )}
          itemRail={itemRail}
          canvas={(
            <>
              {editorCanvas}
              {typePicker}
              {typeSelectionNotice && (
                <Notice
                  tone="success"
                  className="absolute bottom-3 left-1/2 z-40 -translate-x-1/2 shadow-lg"
                >
                  {typeSelectionNotice}
                </Notice>
              )}
            </>
          )}
          topActions={topActions}
          inspector={itemInspector}
          toolbar={(
            <RightToolbar
              activeTab={activeTab}
              setActiveTab={panels.toggleTab}
              isCompact={isMobile}
            />
          )}
          mobileItemRail={mobileItemRail}
        >
          {notice && (
            <div
              className="fixed left-1/2 z-50 -translate-x-1/2 px-4"
              style={{
                bottom: "calc(5rem + env(safe-area-inset-bottom))",
              }}
            >
              <Notice
                tone={notice.tone}
                pending={notice.pending}
                className="shadow-lg"
              >
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
            onClose={panels.closeConfirmDialog}
            onConfirm={panels.confirmPendingAction}
            title={confirmDialog.title}
            description={confirmDialog.description}
            confirmText={confirmDialog.confirmText}
            cancelText={confirmDialog.cancelText}
            confirmVariant="destructive"
            isLoading={false}
          />
        </EditorShell>
      </EditorItemDraftBoundary>
    </DesignDraftProvider>
  );
}
