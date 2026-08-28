import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Trophy } from "lucide-react";
import { quizService } from "../../../services/quizService.ts";
import { useState, useEffect, useMemo } from "react";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";


const buildDisplaySlides = (slidesData) => {
  const result = [];

  slidesData.forEach((slide) => {
    result.push({ ...slide, isSynthetic: false });

    if (slide.slide_type === 1 && slide.show_leaderboard_after) {
      result.push({
        slide_id: `leaderboard:${slide.slide_id}`,
        slide_type: 3,
        order: slide.order,
        show_leaderboard_after: false,
        title: null,
        content_text: null,
        content_image_url: null,
        question: null,
        leaderboard: [],
        isSynthetic: true,
        sourceSlideId: slide.slide_id,
      });
    }
  });

  return result;
};

export default function SlidesPanel({
  slides = [],
  activeSlideId,
  setActiveSlideId,
  setActiveSlideTypeParent,
  addNewSlide,
  deleteSlide,
  idKey = "slide_id",
  getSlideTitle,
  quizId,
  presentationRevision,
  quizBackground = "#ffffff",
  quizBackgroundImage = "",
  onSlidesReordered,
  onRefresh,
  onNotify
}) {
  const [isReordering, setIsReordering] = useState(false);
  const [localSlides, setLocalSlides] = useState([]);
  const [activeSlideType, setActiveSlideType] = useState(null); // ???? ???? ???? ????? slide_type ?????? ????
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: null,
    confirmText: "",
    cancelText: "",
  });

  const notify = (message, tone = "error") => {
    if (onNotify) {
      onNotify(message, tone);
    } else {
      alert(message);
    }
  };

  // ???? ???? ?????? ????????

  // ???? ???? ?????? ???????? ?? API
  useEffect(() => {
    setLocalSlides(slides);

    if (activeSlideId && slides.length > 0) {
      const activeSlide = slides.find((s) => s[idKey] === activeSlideId);
      if (activeSlide) {
        setActiveSlideType(activeSlide.slide_type);
        if (setActiveSlideTypeParent) {
          setActiveSlideTypeParent(activeSlide.slide_type);
        }
      }
    }
  }, [slides, activeSlideId, idKey, setActiveSlideTypeParent]);

  const displaySlides = useMemo(
    () => buildDisplaySlides(localSlides),
    [localSlides]
  );

  const draggableIndexMap = useMemo(() => {
    const map = new Map();
    localSlides.forEach((slide, index) => {
      map.set(`${slide[idKey]}-${slide.slide_type}`, index);
    });
    return map;
  }, [localSlides, idKey]);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    setIsReordering(true);
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) {
      setIsReordering(false);
      return;
    }
    
    const previousSlides = Array.from(localSlides);
    const newSlides = Array.from(localSlides);
    const [movedSlide] = newSlides.splice(sourceIndex, 1);
    newSlides.splice(destinationIndex, 0, movedSlide);
    
    setLocalSlides(newSlides);
    
    try {
      const slideIds = newSlides.map((slide) => slide[idKey]);
      await quizService.reorderSlides(quizId, slideIds, presentationRevision);
      if (onSlidesReordered) {
        onSlidesReordered(newSlides);
      }
      if (onRefresh) await onRefresh();
    } catch (error) {
      console.error("Failed to update slide order:", error);
      notify("Failed to reorder slide.", "error");
      setLocalSlides(previousSlides);
      if (error.response?.status === 409 && onRefresh) await onRefresh();
    } finally {
      setIsReordering(false);
    }
  };


  const handleDeleteSlide = (slideId, slideType) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Slide",
      description: "Are you sure you want to delete this slide?",
      onConfirm: async () => {
        await performDeleteSlide(slideId, slideType);
      },
      confirmText: "Delete",
      cancelText: "Cancel",
    });
  };

  const performDeleteSlide = async (slideId, slideType) => {
    try {
      const slideToDelete = displaySlides.find(
        (s) => s[idKey] === slideId && s.slide_type === slideType
      );

      if (!slideToDelete) return;

      if (slideType === 3) {
        // ??? ??? ??????? ?????
        const questionSlide = localSlides.find(
          (s) => s.slide_type === 1 && s[idKey] === slideToDelete.sourceSlideId
        );

        if (questionSlide) {
          await quizService.deleteLeaderboardSlide(quizId, questionSlide);
        } else {
          await deleteSlide(slideId);
        }
      } else {
        // ??? ?????? ?????
        await deleteSlide(slideId);
      }

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to delete slide:", error);
      notify("Failed to delete slide.", "error");
    }
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

  const handleCancelForModal = () => {
    closeConfirmDialog();
  };


  // ???? ????? ???? ?????? ????
  const handleAddSlide = async () => {
    try {
      const createdSlide = await addNewSlide();
      if (createdSlide && onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error("Failed to add new slide:", error);
      notify("Failed to add new slide.", "error");
    }
  };

  // ???? ???? ??? ?????? - ???? ???? ?? ????
  const handleSlideClick = (slide) => {
    // ????? slide_id ?? ?? ???? ??? ???????
    setActiveSlideId(slide.isSynthetic ? slide.sourceSlideId : slide[idKey]);
    // ? slide_type ?????? ???? ?? ?? ????? ???????
    setActiveSlideType(slide.slide_type);
    setActiveSlideTypeParent(slide.slide_type);
  };

  // ???? ???? ????? ????? ??? ?????? ???? ?????? ??? ???
  const isSlideActive = (slide) => {
    const selectedId = slide.isSynthetic ? slide.sourceSlideId : slide[idKey];
    if (selectedId !== activeSlideId) {
      return false;
    }
    
    // ??? slide_id ?????? ????? ???? ???? slide_type ?? ?? ????? ????
    // ??? slide_type ????? ??? ????? (activeSlideType) ?? ?? ??????? ??
    if (activeSlideType !== null) {
      return slide.slide_type === activeSlideType;
    }
    
    // ??? activeSlideType ??????? ???? ??? ???? ????? ???
    // ?? ??? ????? ??? ??????? ?? ????? ?????? ?? ??? slide_id ?????? ???
    return true;
  };

  // ???? ???? ???? ?????? ??? ????
  const getQuestionType = (slide) => {
    if (slide.slide_type === 3) {
      return "جدول امتیازات";
    }
    if (slide.slide_type === 2) {
      return "محتوا";
    }
    
    if (slide.slide_type === 1 && slide.question) {
      return slide.question.question_type === "single" ? "تک‌گزینه‌ای" : 
            slide.question.question_type === "multiple" ? "چندگزینه‌ای" : 
            "انتخاب نشده";
    }
    
    return "انتخاب نشده";
  };

  // ???? ???? ?????? ???????? ??????
  const getSlideBackground = () => {
    if (quizBackgroundImage) {
      return {
        backgroundImage: `url(${quizBackgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      };
    }
    
    return {
      backgroundColor: quizBackground || "#f3f4f6"
    };
  };

  // ????? ??? ?????? ??????? ??? ?? ??? ?????? ???? ????
  const hasLeaderboardAfter = (slide) => {
    if (slide.slide_type !== 1) return false;

    return !!slide.show_leaderboard_after;
  };

  // ???? ???? ??????? ???? ??? ???? ????????? ???????
  const isDragDisabled = (slide) => {
    if (slide.isSynthetic || slide.slide_type === 3) {
      return true;
    }
    return isReordering;
  };


  // ???? ???? ????? key ????????? ???? ?? ??????
  const getUniqueKey = (slide) => {
    // ????? slide_id ? slide_type ???? ????? key ?????????
    return `${slide[idKey]}-${slide.slide_type}`;
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-slate-800">اسلایدها</h2>
        {isReordering && (
          <span className="animate-pulse text-xs text-blue-500 motion-reduce:animate-none">در حال مرتب‌سازی…</span>
        )}
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
                const slideBackground = getSlideBackground(slide);
                const isLeaderboardSlide = slide.slide_type === 3;
                const isQuestionSlide = slide.slide_type === 1;
                const slideTitle = getSlideTitle(slide);
                const dragDisabled = isDragDisabled(slide);
                const isActive = isSlideActive(slide);
                const uniqueKey = getUniqueKey(slide);
                const draggableIndex = draggableIndexMap.get(uniqueKey);

                if (slide.isSynthetic) {
                  return (
                    <div
                      key={uniqueKey}
                      onClick={() => handleSlideClick(slide)}
                      className={`relative cursor-pointer border rounded-lg overflow-hidden transition-all
                        w-full aspect-[16/9] max-w-[360px] mx-auto
                        ${isActive
                          ? "border-slate-600 outline-2 outline-slate-500 outline"
                          : "border-gray-300 hover:shadow-md"
                        }
                      `}
                      style={slideBackground}
                    >
                      {/* Delete button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSlide(slide[idKey], slide.slide_type);
                        }}
                        disabled={isReordering}
                        className="absolute top-1 right-2 p-2 rounded-md bg-white/90 hover:bg-red-50 text-red-600 shadow-sm z-20 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Title */}
                      <div
                        className="absolute top-10 left-2 right-2 text-sm font-semibold text-black/90 bg-white/80 p-2 rounded leading-tight overflow-hidden text-center"
                        style={{
                          maxHeight: "110px",
                          wordBreak: "break-word",
                          WebkitLineClamp: 6,
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Trophy className="w-8 h-8 text-yellow-500" />
                          {slideTitle}
                        </div>
                      </div>

                      {/* Type and info */}
                      <div className="absolute bottom-2 left-2 right-2 text-xs text-center space-y-1">
                        <div className="bg-white/80 py-1 rounded font-medium text-gray-700">
                          {getQuestionType(slide)}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (draggableIndex === undefined) {
                  return null;
                }

                return (
                  <Draggable
                    key={uniqueKey}
                    draggableId={uniqueKey}
                    index={draggableIndex}
                    isDragDisabled={dragDisabled}
                  >
                    {(provided, snapshot) => {
                      const mergedStyle = {
                        ...provided.draggableProps.style,
                        ...slideBackground,
                        transform: snapshot.isDragging 
                          ? `${provided.draggableProps.style?.transform || ''} rotate(2deg)` 
                          : provided.draggableProps.style?.transform,
                        boxShadow: snapshot.isDragging 
                          ? "0 10px 25px rgba(0, 0, 0, 0.2)" 
                          : "none"
                      };

                      return (
                        <div
                          {...provided.draggableProps}
                          ref={provided.innerRef}
                          onClick={() => handleSlideClick(slide)}
                          className={`relative cursor-pointer border rounded-lg overflow-hidden transition-all
                            w-full aspect-[16/9] max-w-[360px] mx-auto
                            ${isActive
                              ? "border-slate-600 outline-2 outline-slate-500 outline"
                              : "border-gray-300 hover:shadow-md"
                            }
                            ${dragDisabled ? 'opacity-90' : ''}
                            ${snapshot.isDragging ? 'z-50' : 'z-0'}
                          `}
                          style={mergedStyle}
                        >
                          {/* Drag handle */}
                          {!dragDisabled && (
                            <div
                              {...provided.dragHandleProps}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="absolute top-1 right-11 p-1.5 bg-white/90 rounded-md shadow-sm cursor-grab hover:bg-white z-20 active:cursor-grabbing"
                            >
                              <GripVertical className="w-5 h-5 text-gray-700" />
                            </div>
                          )}

                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSlide(slide[idKey], slide.slide_type);
                            }}
                            disabled={isReordering}
                            className="absolute top-1 right-2 p-2 rounded-md bg-white/90 hover:bg-red-50 text-red-600 shadow-sm z-20 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Leaderboard indicator for question slides */}
                          {isQuestionSlide && hasLeaderboardAfter(slide) && (
                            <div className="absolute top-1 left-2 p-2 bg-yellow-500 text-white text-xs rounded-md z-20 flex items-center gap-1">
                              <Trophy className="w-3 h-3" />
                              LB
                            </div>
                          )}

                          {/* Title */}
                          <div
                            className="absolute top-10 left-2 right-2 text-sm font-semibold text-black/90 bg-white/80 p-2 rounded leading-tight overflow-hidden text-center"
                            style={{
                              maxHeight: "110px",
                              wordBreak: "break-word",
                              WebkitLineClamp: 6,
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {isLeaderboardSlide ? (
                              <div className="flex flex-col items-center gap-2">
                                <Trophy className="w-8 h-8 text-yellow-500" />
                                {slideTitle}
                              </div>
                            ) : (
                              slideTitle
                            )}
                          </div>

                          {/* Type and info */}
                          <div className="absolute bottom-2 left-2 right-2 text-xs text-center space-y-1">
                            <div className="bg-white/80 py-1 rounded font-medium text-gray-700">
                              {getQuestionType(slide)}
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
        onClick={handleAddSlide}
        disabled={isReordering}
        className={`mt-4 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-green-100 
          w-full aspect-[16/9] max-w-[360px] mx-auto flex items-center justify-center
          ${isReordering ? 'opacity-50 cursor-not-allowed' : 'border-gray-300 text-gray-500 hover:border-green-300'}`}
      >
        + افزودن اسلاید
      </button>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCancelForModal}
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
