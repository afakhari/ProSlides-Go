import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  CheckCircle2,
  GripVertical,
  Trash2,
  Trophy,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";

import { ConfirmDialog } from "../../../../shared/ui/primitives/ConfirmDialog.tsx";
import type { EditorSlide } from "../../model/editor.ts";
import { getEditorItemBehaviors } from "../../model/itemRegistry.ts";
import { useOptionalDesignDraft } from "../model/useDesignDraftContext.ts";
import {
  buildSlideListItems,
  getSlideListTitle,
  getSlideListTypeLabel,
  type SlideListItem,
} from "../model/slideListModel.ts";

type SlidesPanelProps = {
  slides: EditorSlide[];
  activeSlideId: string | null;
  onSelectSlide: (slideId: string) => void;
  addNewSlide: () => void;
  deleteSlide: (slideId: string) => void | Promise<void>;
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
  onSelectSlide,
  addNewSlide,
  deleteSlide,
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteSlide(deleteTarget.slide_id);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const structuralActionsDisabled = isReordering || reorderDisabled;

  return (
    <div className="w-full" aria-label="فهرست آیتم‌های ارائه">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-bold text-slate-800">آیتم‌ها</h2>
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
        <Droppable droppableId="editor-items">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
            >
              {displaySlides.map((slide, index) => {
                const slideBackground = getSlideBackground();
                const slideTitle = getSlideListTitle(slide);
                const typeLabel = getSlideListTypeLabel(slide);
                const behaviors = getEditorItemBehaviors(slide);
                const isActive = slide.slide_id === activeSlideId;
                const dragDisabled = structuralActionsDisabled;

                return (
                  <Draggable
                    key={slide.slide_id}
                    draggableId={slide.slide_id}
                    index={index}
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
                            onClick={() => onSelectSlide(slide.slide_id)}
                            aria-label={`انتخاب آیتم ${slideTitle}`}
                            aria-pressed={isActive}
                            className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                          >
                            <span className="sr-only">
                              انتخاب آیتم {slideTitle}
                            </span>
                          </button>

                          {!dragDisabled && (
                            <div
                              {...provided.dragHandleProps}
                              aria-label={`جابه‌جایی آیتم ${slideTitle}`}
                              title="جابه‌جایی آیتم"
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
                            aria-label={`حذف آیتم ${slideTitle}`}
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

                          {behaviors.length > 0 && (
                            <div className="absolute left-2 top-1 z-20 flex max-w-[65%] flex-wrap justify-end gap-1">
                              {behaviors.map((behavior) => (
                                <span
                                  key={behavior.id}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                                    behavior.tone === "warning"
                                      ? "border-warning-border bg-warning-soft text-warning-ink"
                                      : "border-info-border bg-info-soft text-info"
                                  }`}
                                >
                                  {behavior.id === "overall-ranking" ? (
                                    <Trophy className="h-3 w-3" aria-hidden="true" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  )}
                                  {behavior.label}
                                </span>
                              ))}
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
                            <bdi>{slideTitle}</bdi>
                          </div>

                          <div className="absolute bottom-2 left-2 right-2 space-y-1 text-center text-xs">
                            <div className="rounded bg-white/80 py-1 font-medium text-gray-700">
                              {typeLabel}
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
        + افزودن آیتم
      </button>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="حذف آیتم"
        description="مطمئنید می‌خواهید این آیتم را حذف کنید؟"
        confirmText="حذف"
        cancelText="انصراف"
        confirmVariant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
