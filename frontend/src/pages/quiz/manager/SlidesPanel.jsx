import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Trophy } from "lucide-react";
import { quizService } from "../../../services/quizService";
import { useState, useEffect, useCallback } from "react";

export default function SlidesPanel({
  activeSlideId,
  setActiveSlideId,
  setActiveSlideTypeParent,
  addNewSlide,
  deleteSlide,
  idKey = "slide_id",
  getSlideTitle,
  quizId,
  quizBackground = "#ffffff",
  quizBackgroundImage = ""
}) {
  const [isReordering, setIsReordering] = useState(false);
  const [processedSlides, setProcessedSlides] = useState([]);
  const [localSlides, setLocalSlides] = useState([]);
  const [activeSlideType, setActiveSlideType] = useState(null); // حالت جدید برای ذخیره slide_type اسلاید فعال

  // تابع برای پردازش اسلایدها
  // const processSlides = (slidesData) => {
  //   const result = [];
  //   let i = 0;

  //   while (i < slidesData.length) {
  //     const currentSlide = slidesData[i];
      
  //     if (currentSlide.slide_type === 3) { // لیدربرد
  //       const prevSlide = i > 0 ? slidesData[i - 1] : null;
        
  //       if (prevSlide && prevSlide.slide_type === 1 && 
  //           currentSlide.order === prevSlide.order) {
  //         result.push(currentSlide);
  //         i++;
  //       } else {
  //         result.push(currentSlide);
  //         i++;
  //       }
  //     } else {
  //       result.push(currentSlide);
  //       i++;
  //     }
  //   }

  //   return result;
  // };


  // تابع برای پردازش اسلایدها
const processSlides = useCallback((slidesData) => {
  const result = [];
  let i = 0;

  console.log("Processing slides:", slidesData);

  while (i < slidesData.length) {
    const currentSlide = slidesData[i];
    
    console.log(`Processing slide ${i}:`, currentSlide.slide_id, currentSlide.slide_type, currentSlide.order);
    
    if (currentSlide.slide_type === 3) { // لیدربرد
      console.log("Found leaderboard slide");
      const prevSlide = i > 0 ? slidesData[i - 1] : null;
      
      if (prevSlide && prevSlide.slide_type === 1 && 
          currentSlide.order === prevSlide.order) {
        console.log("Leaderboard is linked to previous question");
        result.push(currentSlide);
        i++;
      } else {
        console.log("Standalone leaderboard or order mismatch");
        result.push(currentSlide);
        i++;
      }
    } else {
      console.log("Regular slide");
      result.push(currentSlide);
      i++;
    }
  }

  console.log("Processed result:", result);
  return result;
}, []);



  //////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // تابع برای دریافت اسلایدها از API
  const fetchSlides = useCallback(async () => {
    try {
      const quizData = await quizService.getSlidesFromAPI(quizId);
      const slidesData = quizData.slides;
      const processed = processSlides(slidesData);
      setProcessedSlides(processed);
      setLocalSlides(processed);
    } catch (error) {
      console.error("Error fetching slides:", error);
    }
  }, [processSlides, quizId]);

  // دریافت اولیه اسلایدها
  useEffect(() => {
    if (quizId) {
      fetchSlides();
    }
  }, [fetchSlides, quizId]);


  // به‌روزرسانی localSlides وقتی processedSlides تغییر کرد
  useEffect(() => {
    setLocalSlides(processedSlides);
    
    // وقتی اسلایدها بارگیری شدند، slide_type اسلاید فعال را پیدا کن
    if (activeSlideId && processedSlides.length > 0) {
      const activeSlide = processedSlides.find(s => s[idKey] === activeSlideId);
      if (activeSlide) {
        setActiveSlideType(activeSlide.slide_type);
      }
    }
  }, [processedSlides, activeSlideId, idKey]);
















  // تابع برای به‌روزرسانی اسلایدها
  const refreshSlides = () => {
    fetchSlides();
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    setIsReordering(true);
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) {
      setIsReordering(false);
      return;
    }
    
    const newSlides = Array.from(localSlides);
    const [movedSlide] = newSlides.splice(sourceIndex, 1);
    newSlides.splice(destinationIndex, 0, movedSlide);
    
    setLocalSlides(newSlides);
    
    const newOrder = destinationIndex + 1;
    
    try {
      await quizService.updateSlideOrder(quizId, movedSlide[idKey], newOrder);
      refreshSlides();
    } catch (error) {
      console.error("Failed to update slide order:", error);
      alert("❌ Failed to reorder slide");
      setLocalSlides(processedSlides);
    } finally {
      setIsReordering(false);
    }
  };

  ////////////////////////////////////////////////////////////////////////////////////////////

  const handleDeleteSlide = async (slideId, slideType) => {
  if (!window.confirm("Are you sure you want to delete this slide?")) return;

  try {
    const slideToDelete = processedSlides.find(
      s => s[idKey] === slideId && s.slide_type === slideType
    );

    if (!slideToDelete) return;

    if (slideType === 3) {
      // حذف فقط لیدربرد مرتبط
      const questionSlide = processedSlides.find(
        s => s.slide_type === 1 && s.order === slideToDelete.order
      );

      if (questionSlide) {
        await quizService.deleteLeaderboardSlide(
          quizId,
          questionSlide[idKey]
        );
      } else {
        await deleteSlide(slideId);
      }
    } else {
      // حذف اسلاید معمولی
      await deleteSlide(slideId);
    }

    refreshSlides();
  } catch (error) {
    console.error("Failed to delete slide:", error);
    alert("❌ Failed to delete slide");
  }
};



  ///////////////////////////////////////////////////////////////////////////////////////////////////

  // تابع اضافه کردن اسلاید جدید
  const handleAddSlide = async () => {
    try {
      await addNewSlide();
      refreshSlides();
    } catch (error) {
      console.error("Failed to add new slide:", error);
      alert("❌ Failed to add new slide");
    }
  };

  // تابع کلیک روی اسلاید - کلید اصلی حل مشکل
  const handleSlideClick = (slide) => {
    // همیشه slide_id را به پرنت پاس می‌دهیم
    setActiveSlideId(slide[idKey]);
    // و slide_type اسلاید فعلی را هم ذخیره می‌کنیم
    setActiveSlideType(slide.slide_type);
    setActiveSlideTypeParent(slide.slide_type);
  };

  // تابع برای بررسی اینکه آیا اسلاید فعلی انتخاب شده است
  const isSlideActive = (slide) => {
    // اول بررسی کن که آیا slide_id مطابقت دارد
    if (slide[idKey] !== activeSlideId) {
      return false;
    }
    
    // اگر slide_id مطابقت دارد، حالا باید slide_type را هم بررسی کنیم
    // اگر slide_type ذخیره شده داریم (activeSlideType) از آن استفاده کن
    if (activeSlideType !== null) {
      return slide.slide_type === activeSlideType;
    }
    
    // اگر activeSlideType نداریم، ممکن است مشکل ایجاد شود
    // در این حالت، فرض می‌کنیم که اولین اسلاید با این slide_id انتخاب شده
    return true;
  };

  // تابع کمکی برای دریافت نوع سوال
  const getQuestionType = (slide) => {
    if (slide.slide_type === 3) {
      return "Leaderboard";
    }
    
    if (slide.slide_type === 1 && slide.question) {
      return slide.question.question_type === "single" ? "Single Choice" : 
            slide.question.question_type === "multiple" ? "Multiple Choice" : 
            "Not Selected";
    }
    
    return "Not Selected";
  };

  // تابع برای دریافت پس‌زمینه اسلاید
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

  // بررسی آیا اسلاید لیدربرد بعد از این اسلاید وجود دارد
  const hasLeaderboardAfter = (slide) => {
    if (slide.slide_type !== 1) return false;
    
    const currentIndex = localSlides.findIndex(s => s[idKey] === slide[idKey] && s.slide_type === slide.slide_type);
    if (currentIndex !== -1 && currentIndex + 1 < localSlides.length) {
      const nextSlide = localSlides[currentIndex + 1];
      return nextSlide.slide_type === 3 && 
            nextSlide.order === slide.order;
    }
    return false;
  };

  // تابع برای غیرفعال کردن درگ برای اسلایدهای لیدربرد
  const isDragDisabled = (slide) => {
    if (slide.slide_type === 3) {
      const slideIndex = localSlides.findIndex(s => s[idKey] === slide[idKey] && s.slide_type === slide.slide_type);
      if (slideIndex > 0) {
        const prevSlide = localSlides[slideIndex - 1];
        if (prevSlide.slide_type === 1 && 
            slide.order === prevSlide.order) {
          return true;
        }
      }
    }
    return isReordering;
  };

  // محاسبه order برای نمایش

  // تابع برای ایجاد key منحصربفرد برای هر اسلاید
  const getUniqueKey = (slide) => {
    // ترکیب slide_id و slide_type برای ایجاد key منحصربفرد
    return `${slide[idKey]}-${slide.slide_type}`;
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold">Slides</h2>
        {isReordering && (
          <span className="text-xs text-blue-500 animate-pulse">Updating Order...</span>
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
              {localSlides.map((slide, index) => {
                const slideBackground = getSlideBackground();
                const isLeaderboardSlide = slide.slide_type === 3;
                const isQuestionSlide = slide.slide_type === 1;
                const slideTitle = getSlideTitle(slide);
                const dragDisabled = isDragDisabled(slide);
                const isActive = isSlideActive(slide);
                const uniqueKey = getUniqueKey(slide);

                return (
                  <Draggable
                    key={uniqueKey} // استفاده از key منحصربفرد
                    draggableId={uniqueKey} // استفاده از شناسه منحصربفرد برای drag
                    index={index}
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
                              // handleDeleteSlide(slide[idKey]);
                              handleDeleteSlide(slide[idKey], slide.slide_type);
                            }}
                            disabled={isReordering}
                            className="absolute top-1 right-2 p-2 rounded-md bg-white/90 hover:bg-red-50 text-red-600 shadow-sm z-20 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Order indicator */}
                          {/* <div className="absolute top-1 left-1 p-1.5 bg-black/70 text-white text-xs rounded-md z-20">
                            {getDisplayOrder(slide, index)}
                          </div> */}

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
                                {/* {dragDisabled && (
                                  <span className="text-xs text-gray-500 italic">
                                    (Linked to previous slide)
                                  </span>
                                )} */}
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

      <div
        onClick={handleAddSlide}
        disabled={isReordering}
        className={`mt-4 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-green-100 
          w-full aspect-[16/9] max-w-[360px] mx-auto flex items-center justify-center
          ${isReordering ? 'opacity-50 cursor-not-allowed' : 'border-gray-300 text-gray-500 hover:border-green-300'}`}
      >
        ➕ Add Slide
      </div>
    </div>
  );
}
