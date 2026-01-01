// import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
// import { GripVertical, Trash2, Trophy} from "lucide-react";

// export default function SlidesPanel({
//   slides,
//   activeSlideId,
//   setActiveSlideId,
//   addNewSlide,
//   deleteSlide,
//   reorderSlides,
//   idKey = "question_id",
//   titleKey = "question_text",
// }) {
//   return (
//     <div className="w-full">
//       <h2 className="font-semibold mb-3">Slides</h2>

//       <DragDropContext onDragEnd={reorderSlides}>
//         <Droppable droppableId="slides">
//           {(provided) => (
//             <div
//               {...provided.droppableProps}
//               ref={provided.innerRef}
//               className="space-y-4"
//             >
//               {slides.map((slide, index) => {
//                 const bgImage = slide.backgroundImage
//                   ? `url(${slide.backgroundImage})`
//                   : "none";

//                 const bgColor = slide.backgroundImage
//                   ? ""
//                   : slide.backgroundColor || "#f3f3f3";

//                 return (
//                   <Draggable
//                     key={slide[idKey]}
//                     draggableId={slide[idKey].toString()}
//                     index={index}
//                   >
//                     {(provided) => {
//                       const mergedStyle = {
//                         ...provided.draggableProps.style,
//                         backgroundImage: bgImage,
//                         backgroundSize: "cover",
//                         backgroundPosition: "center",
//                         backgroundColor: bgColor,
//                       };

//                       return (
//                         <div
//                           {...provided.draggableProps}
//                           ref={provided.innerRef}
//                           onClick={() => setActiveSlideId(slide[idKey])}
//                           className={`relative cursor-pointer border rounded-lg overflow-hidden transition-all
//                             w-full aspect-[16/9] max-w-[360px] mx-auto
//                             ${slide[idKey] === activeSlideId
//                               ? "border-blue-500 ring-2 ring-blue-300"
//                               : "border-gray-300 hover:shadow-md"
//                             }
//                           `}
//                           style={mergedStyle}
//                         >
//                           {/* Drag handle */}
//                           <div
//                             {...provided.dragHandleProps}
//                             onMouseDown={(e) => e.stopPropagation()}
//                             className="absolute top-1 right-10 p-1.5 bg-white/90 rounded-md shadow-sm cursor-grab hover:bg-white z-20"
//                           >
//                             <GripVertical className="w-5 h-5 text-gray-700" />
//                           </div>

//                           {/* Delete button */}
//                           <button
//                             onClick={(e) => {
//                               e.stopPropagation();
//                               deleteSlide(slide[idKey]);
//                             }}
//                             className="absolute top-1 right-1 p-2 rounded-md bg-white/90 hover:bg-red-50 text-red-600 shadow-sm z-20"
//                           >
//                             <Trash2 className="w-4 h-4" />
//                           </button>

//                           {/* Title */}
//                           <div
//                             className="absolute top-10 left-2 right-2 text-sm font-semibold text-black/90 bg-white/80 p-2 rounded leading-tight overflow-hidden text-center"
//                             style={{
//                               maxHeight: "110px",
//                               wordBreak: "break-word",
//                               WebkitLineClamp: 6,
//                               display: "-webkit-box",
//                               WebkitBoxOrient: "vertical",
//                             }}
//                           >
//                             {slide.slide_type === 2 ? (
//                               <div className="flex flex-col items-center gap-2">
//                                 <Trophy className="w-8 h-8 text-yellow-500" />
//                                 {slide.leaderboard_title || "Leaderboard"}
//                               </div>
//                             ) : (
//                               slide[titleKey]
//                             )}
//                           </div>

//                           {/* Type */}
//                           <div className="absolute bottom-2 left-2 right-2 text-xs text-center bg-white/80 py-1 rounded font-medium text-gray-700">
//                             {slide.slide_type === 2 ? "Leaderboard" : 
//                               slide.question_type === "single" ? "Single Choice" : 
//                               slide.question_type === "multiple" ? "Multiple Choice" : "Not Selected"
//                             }
//                           </div>
//                         </div>
//                       );
//                     }}
//                   </Draggable>
//                 );
//               })}

//               {provided.placeholder}
//             </div>
//           )}
//         </Droppable>
//       </DragDropContext>

//       <div
//         onClick={addNewSlide}
//         className="mt-4 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg p-6 text-center cursor-pointer hover:bg-green-100 w-full aspect-[16/9] max-w-[360px] mx-auto flex items-center justify-center"
//       >
//         ➕ Add Slide
//       </div>
//     </div>
//   );
// }











import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Trophy} from "lucide-react";
import { quizService } from "../../../services/quizService";
import { useState } from "react";

export default function SlidesPanel({
  slides,
  activeSlideId,
  setActiveSlideId,
  addNewSlide,
  deleteSlide,
  reorderSlides,
  idKey = "slide_id",
  getSlideTitle,
  quizId,
  quizBackground = "#ffffff",
  quizBackgroundImage = ""
}) {
  const [isReordering, setIsReordering] = useState(false);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    setIsReordering(true);
    
    // محاسبه order جدید بر اساس موقعیت
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    // اگر به همان موقعیت کشیده شده، کاری نکن
    if (sourceIndex === destinationIndex) {
      setIsReordering(false);
      return;
    }
    
    // ایجاد کپی از اسلایدها برای به‌روزرسانی
    const reordered = Array.from(slides);
    const [movedSlide] = reordered.splice(sourceIndex, 1);
    reordered.splice(destinationIndex, 0, movedSlide);
    
    // به‌روزرسانی order برای همه اسلایدها
    const updatedSlides = reordered.map((slide, index) => ({
      ...slide,
      order: index + 1
    }));
    
    try {
      // ارسال درخواست به بک‌اند برای به‌روزرسانی order
      await quizService.reorderSlides(quizId, updatedSlides);
      
      // فراخوانی تابع reorderSlides والد برای به‌روزرسانی state
      reorderSlides(result);
    } catch (error) {
      console.error("Failed to reorder slides:", error);
      alert("❌ Failed to reorder slides");
    } finally {
      setIsReordering(false);
    }
  };

  // تابع حذف اسلاید با ارسال درخواست به بک‌اند
  const handleDeleteSlide = async (slideId) => {
    if (!window.confirm("Are you sure you want to delete this slide?")) return;
    
    try {
      // ارسال درخواست DELETE به بک‌اند
      await quizService.deleteSlide(quizId, slideId);
      
      // فراخوانی تابع deleteSlide والد
      deleteSlide(slideId);
    } catch (error) {
      console.error("Failed to delete slide:", error);
      alert("❌ Failed to delete slide");
    }
  };

  // تابع اضافه کردن اسلاید جدید
  const handleAddSlide = async () => {
    try {
      const newSlideData = {
        slide_type: 1,
        order: 1, // آخرین موقعیت
        show_leaderboard_after: false,
        title: "",
        content_text: "",
        content_image_url: "",
      };

      // فراخوانی تابع addNewSlide والد که باید اسلاید را ایجاد کند
      await addNewSlide(newSlideData);
    } catch (error) {
      console.error("Failed to add new slide:", error);
      alert("❌ Failed to add new slide");
    }
  };

  // تابع کمکی برای دریافت عنوان اسلاید
  // const getSlideTitle = (slide) => {
  //   if (typeof titleKey === 'function') {
  //     return titleKey(slide);
  //   }
    
  //   if (slide.slide_type === 1) {
  //     // برای اسلاید سوال
  //     if (slide.question) {
  //       return slide.question.title || slide.question.text || "Question";
  //     }
  //     return "Question";
  //   } else if (slide.slide_type === 3) {
  //     // برای اسلاید لیدربرد
  //     return slide.title || "Leaderboard";
  //   }
    
  //   // تلاش برای استفاده از titleKey یا مقدار پیش‌فرض
  //   return slide[titleKey] || "Slide";
  // };

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
    // استفاده از بک‌گراند کوئیز به عنوان اولویت
    if (quizBackgroundImage) {
      return {
        backgroundImage: `url(${quizBackgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      };
    }
    
    return {
      backgroundColor: quizBackground || "#f3f3f3"
    };
  };

  // تابع برای نمایش وضعیت لیدربرد
  const hasLeaderboardAfter = (slide) => {
    if (slide.slide_type !== 1) return false;
    
    // بررسی اینکه آیا اسلاید لیدربرد بعد از این اسلاید وجود دارد
    const currentIndex = slides.findIndex(s => s.slide_id === slide.slide_id);
    if (currentIndex !== -1 && currentIndex + 1 < slides.length) {
      const nextSlide = slides[currentIndex + 1];
      return nextSlide.slide_type === 3 && 
            nextSlide.linked_question_id === slide.question?.question_id;
    }
    return false;
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-semibold">Slides</h2>
        {isReordering && (
          <span className="text-xs text-blue-500 animate-pulse">Updating order...</span>
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
              {slides.map((slide, index) => {
                const slideBackground = getSlideBackground();
                const isLeaderboardSlide = slide.slide_type === 3;
                const isQuestionSlide = slide.slide_type === 1;
                const slideTitle = getSlideTitle(slide);

                return (
                  <Draggable
                    key={slide[idKey]}
                    draggableId={slide[idKey]?.toString() || `slide-${index}`}
                    index={index}
                    isDragDisabled={isReordering}
                  >
                    {(provided) => {
                      const mergedStyle = {
                        ...provided.draggableProps.style,
                        ...slideBackground
                      };

                      return (
                        <div
                          {...provided.draggableProps}
                          ref={provided.innerRef}
                          onClick={() => setActiveSlideId(slide[idKey])}
                          className={`relative cursor-pointer border rounded-lg overflow-hidden transition-all
                            w-full aspect-[16/9] max-w-[360px] mx-auto
                            ${slide[idKey] === activeSlideId
                              ? "border-blue-500 ring-2 ring-blue-300"
                              : "border-gray-300 hover:shadow-md"
                            }
                          `}
                          style={mergedStyle}
                        >
                          {/* Drag handle */}
                          <div
                            {...provided.dragHandleProps}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="absolute top-1 right-10 p-1.5 bg-white/90 rounded-md shadow-sm cursor-grab hover:bg-white z-20"
                          >
                            <GripVertical className="w-5 h-5 text-gray-700" />
                          </div>

                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSlide(slide[idKey]);
                            }}
                            disabled={isReordering}
                            className="absolute top-1 right-1 p-2 rounded-md bg-white/90 hover:bg-red-50 text-red-600 shadow-sm z-20 disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Order indicator */}
                          <div className="absolute top-1 left-1 p-1.5 bg-black/70 text-white text-xs rounded-md z-20">
                            {slide.order || index + 1}
                          </div>

                          {/* Leaderboard indicator for question slides */}
                          {isQuestionSlide && hasLeaderboardAfter(slide) && (
                            <div className="absolute top-8 left-1 p-1 bg-yellow-500 text-white text-xs rounded-md z-20">
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
