import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { GripVertical, Trash2, Trophy } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import type { SlideType } from "../../model/editor.ts";
import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import { useOptionalDesignDraft } from "../model/useDesignDraftContext.ts";
import {
  buildSlideListItems,
  getSlideListTitle,
  getSlideListTypeLabel,
  type SlideListItem,
} from "../model/slideListModel.ts";
import type { EditorSlide } from "../../model/editor.ts";

type SlidesPanelProps = {
  slides: EditorSlide[];
  activeSlideId: string | null;
  activeSlideType: SlideType | null;
  onSelectSlide: (slideId: string, slideType: SlideType) => void;
  addNewSlide: () => void;
  deleteSlide: (slideId: string) => void | Promise<void>;
  deleteLeaderboardSlide: (sourceSlideId: string) => void | Promise<void>;
  quizBackground?: string;
  quizBackgroundImage?: string;
  isReordering: boolean;
  reorderDisabled?: boolean;
  onReorder: (
    sourceIndex: number,
    destinationIndex: number,
  ) => void | Promise<void>;
};

export default function SlidesPanel({
  slides,
  activeSlideId,
  activeSlideType,
  onSelectSlide,
  addNewSlide,
  deleteSlide,
  deleteLeaderboardSlide,
  quizBackground = "#ffffff",
  quizBackgroundImage = "",
  isReordering,
  reorderDisabled = false,
  onReorder,
}: SlidesPanelProps) {
  const designController = useOptionalDesignDraft();
  const [deleteTarget, setDeleteTarget] =
    useState<SlideListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const displaySlides = useMemo(
    () => buildSlideListItems(slides),
    [slides],
  );

  const draggableIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    slides.forEach((slide, index) => {
      map.set(`${slide.slide_id}-${slide.slide_type}`, index);
    });
    return map;
  }, [slides]);

  const getSlideBackground = (): CSSProperties => {
    const backgroundImage =
      designController?.draft.backgroundImageUrl ?? quizBackgroundImage;
    const backgroundColor =
      designController?.draft.backgroundColor ?? quizBackground;

    if (backgroundImage) {
      return {
        backgroundColor: backgroundColor || "#f3f4f6",
        backgroundImage:
          `linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.18)), url(${JSON.stringify(backgroundImage)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }

    return {
      backgroundColor: backgroundColor || "#f3f4f6",
    };
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    void onReorder(result.source.index, result.destination.index);
  };

  const handleSlideClick = (slide: SlideListItem) => {
    onSelectSlide(
      slide.isSynthetic ? slide.sourceSlideId : slide.slide_id,
      slide.slide_type,
    );
  };

  const isSlideActive = (slide: SlideListItem) => {
    const selectedId = slide.isSynthetic
      ? slide.sourceSlideId
      : slide.slide_id;

    return (
      selectedId === activeSlideId &&
      slide.slide_type === activeSlideType
    );
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      if (deleteTarget.isSynthetic) {
        await deleteLeaderboardSlide(deleteTarget.sourceSlideId);
      } else {
        await deleteSlide(deleteTarget.slide_id);
      }
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const structuralActionsDisabled = isReordering || reorderDisabled;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-800">اسلایدها</h2>
        {isReordering ? (
          <span
            className="animate-pulse text-xs text-brand motion-reduce:animate-none"
            role="status"
          >
            در حال مرتب‌سازی…
          </span>
        ) : reorderDisabled ? (
          <span className="text-xs text-content-muted">
            برای مرتب‌سازی، تغییرات را ذخیره یا رها کنید.
          </span>
        ) : null}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="slides">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {displaySlides.map((slide) => {
                const slideBackground = getSlideBackground();
                const isQuestionSlide = slide.slide_type === 1;
                const slideTitle = getSlideListTitle(slide);
                const isActive = isSlideActive(slide);
                const uniqueKey =
                  `${slide.slide_id}-${slide.slide_type}`;
                const dragDisabled =
                  slide.isSynthetic ||
                  slide.slide_type === 3 ||
                  structuralActionsDisabled;
                const draggableIndex =
                  draggableIndexMap.get(uniqueKey);

                if (slide.isSynthetic) {
                  return (
                    <div
                      key={uniqueKey}
                      className={`relative mx-auto aspect-[16/9] w-full max-w-[360px] overflow-hidden rounded-lg border transition-all ${
                        isActive
                          ? "border-slate-600 outline outline-2 outline-slate-500"
                          : "border-border-subtle hover:shadow-md"
                      }`}
                      style={slideBackground}
                    >
                      <button
                        type="button"
                        onClick={() => handleSlideClick(slide)}
                        aria-label={`انتخاب اسلاید ${slideTitle}`}
                        aria-pressed={isActive}
                        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                      >
                        <span className="sr-only">
                          انتخاب اسلاید {slideTitle}
                        </span>
                      </button>

                      <button
                        type="button"
                        aria-label={`حذف اسلاید ${slideTitle}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(slide);
                        }}
                        disabled={structuralActionsDisabled}
                        title={
                          reorderDisabled
                            ? "ابتدا تغییرات ذخیره‌نشده را ذخیره یا رها کنید."
                            : undefined
                        }
                        className="absolute right-2 top-1 z-20 rounded-md bg-surface/95 p-2 text-danger shadow-sm hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>

                      <div
                        className="absolute left-2 right-2 top-10 overflow-hidden rounded bg-white/80 p-2 text-center text-sm font-semibold leading-tight text-black/90"
                        style={{
                          maxHeight: "110px",
                          wordBreak: "break-word",
                          WebkitLineClamp: 6,
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Trophy
                            className="h-8 w-8 text-warning"
                            aria-hidden="true"
                          />
                          {slideTitle}
                        </div>
                      </div>

                      <div className="absolute bottom-2 left-2 right-2 space-y-1 text-center text-xs">
                        <div className="rounded bg-white/80 py-1 font-medium text-gray-700">
                          {getSlideListTypeLabel(slide)}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (draggableIndex === undefined) return null;

                return (
                  <Draggable
                    key={uniqueKey}
                    draggableId={uniqueKey}
                    index={draggableIndex}
                    isDragDisabled={dragDisabled}
                  >
                    {(provided, snapshot) => {
                      const mergedStyle: CSSProperties = {
                        ...provided.draggableProps.style,
                        ...slideBackground,
                        transform: snapshot.isDragging
                          ? `${provided.draggableProps.style?.transform || ""} rotate(2deg)`
                          : provided.draggableProps.style?.transform,
                        boxShadow: snapshot.isDragging
                          ? "0 10px 25px rgba(0, 0, 0, 0.2)"
                          : "none",
                      };

                      return (
                        <div
                          {...provided.draggableProps}
                          ref={provided.innerRef}
                          className={`relative mx-auto aspect-[16/9] w-full max-w-[360px] overflow-hidden rounded-lg border transition-all ${
                            isActive
                              ? "border-slate-600 outline outline-2 outline-slate-500"
                              : "border-border-subtle hover:shadow-md"
                          } ${dragDisabled ? "opacity-90" : ""} ${
                            snapshot.isDragging ? "z-50" : "z-0"
                          }`}
                          style={mergedStyle}
                        >
                          <button
                            type="button"
                            onClick={() => handleSlideClick(slide)}
                            aria-label={`انتخاب اسلاید ${slideTitle}`}
                            aria-pressed={isActive}
                            className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                          >
                            <span className="sr-only">
                              انتخاب اسلاید {slideTitle}
                            </span>
                          </button>

                          {!dragDisabled && (
                            <div
                              {...provided.dragHandleProps}
                              aria-label={`جابه‌جایی اسلاید ${slideTitle}`}
                              title="جابه‌جایی اسلاید"
                              onMouseDown={(event) =>
                                event.stopPropagation()
                              }
                              className="absolute right-11 top-1 z-20 cursor-grab rounded-md bg-surface/95 p-1.5 shadow-sm hover:bg-surface active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                            >
                              <GripVertical
                                className="h-5 w-5 text-gray-700"
                                aria-hidden="true"
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            aria-label={`حذف اسلاید ${slideTitle}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(slide);
                            }}
                            disabled={structuralActionsDisabled}
                            title={
                              reorderDisabled
                                ? "ابتدا تغییرات ذخیره‌نشده را ذخیره یا رها کنید."
                                : undefined
                            }
                            className="absolute right-2 top-1 z-20 rounded-md bg-surface/95 p-2 text-danger shadow-sm hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2
                              className="h-4 w-4"
                              aria-hidden="true"
                            />
                          </button>

                          {isQuestionSlide &&
                            slide.show_leaderboard_after && (
                              <div
                                className="absolute left-2 top-1 z-20 flex items-center gap-1 rounded-md border border-warning-border bg-warning-soft p-2 text-xs font-semibold text-warning-ink"
                                aria-label="نمایش جدول امتیازات بعد از این سؤال"
                              >
                                <Trophy
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                جدول
                              </div>
                            )}

                          <div
                            className="absolute left-2 right-2 top-10 overflow-hidden rounded bg-white/80 p-2 text-center text-sm font-semibold leading-tight text-black/90"
                            style={{
                              maxHeight: "110px",
                              wordBreak: "break-word",
                              WebkitLineClamp: 6,
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {slideTitle}
                          </div>

                          <div className="absolute bottom-2 left-2 right-2 space-y-1 text-center text-xs">
                            <div className="rounded bg-white/80 py-1 font-medium text-gray-700">
                              {getSlideListTypeLabel(slide)}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </Draggable>
                );
              })}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <button
        type="button"
        onClick={addNewSlide}
        disabled={structuralActionsDisabled}
        title={
          reorderDisabled
            ? "ابتدا تغییرات ذخیره‌نشده را ذخیره یا رها کنید."
            : undefined
        }
        className="mx-auto mt-4 flex aspect-[16/9] w-full max-w-[360px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border-subtle p-6 text-center text-content hover:border-success-border hover:bg-success-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        + افزودن اسلاید
      </button>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={
          deleteTarget?.isSynthetic
            ? "حذف جدول امتیازات"
            : "حذف اسلاید"
        }
        description={
          deleteTarget?.isSynthetic
            ? "جدول امتیازات بعد از این سؤال حذف شود؟"
            : "مطمئنید می‌خواهید این اسلاید را حذف کنید؟"
        }
        confirmText="حذف"
        cancelText="انصراف"
        confirmVariant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
