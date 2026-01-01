// import { useState, useEffect } from "react";
// import { useLocation, useParams, useNavigate } from "react-router-dom";
// import MiniResultsResultsOnly from "./MiniResultsResultsOnly";
// import LeaderboardPreview from "./LeaderboardPreview";
// import QuizHeader from "../../../components/QuizHeader";
// import Sidebar from "./Sidebar";
// import SlidesPanel from "./SlidesPanel";
// import RightToolbar from "./RightToolbar";
// import DesignPanel from "./DesignPanel";
// import AudioPanel from "./AudioPanel";
// import { quizService } from "../../../services/quizService";

// export default function EditorPage() {
//   const location = useLocation();
//   const params = useParams();
//   const navigate = useNavigate();

//   const [quiz, setQuiz] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   // استخراج quiz_id از URL یا location state
//   const quizId = location.state?.quiz?.quiz_id ||
//                 new URLSearchParams(location.search).get('quiz_id') ||
//                 params.quizId;

//   useEffect(() => {
//     const fetchQuiz = async () => {
//       if (!quizId) {
//         setError("There is no quiz.");
//         console.error(err);
//       }

//       try {
//         // اگر quiz_id داریم، کوئیز را از سرور بگیر
//         const quizData = await quizService.getQuiz(quizId);
//         setQuiz(quizData);
//       } catch (err) {
//         setError("Failed to load quiz");
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchQuiz();
//   }, [quizId, navigate]);

//   const updateQuiz = (updatedQuiz) => {
//     setQuiz(updatedQuiz);
//   };

//   const saveQuiz = async () => {
//     if (!quiz) return;

//     try {
//       const savedQuiz = await quizService.updateQuiz(quiz.quiz_id, quiz);
//       setQuiz(savedQuiz);
//       alert("✅ Quiz saved successfully!");
//     } catch (err) {
//       alert("❌ Failed to save quiz");
//       console.error(err);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="h-screen flex items-center justify-center">
//         <div className="text-xl text-purple-700">Loading Quiz...</div>
//       </div>
//     );
//   }

//   if (error || !quiz) {
//     return (
//       <div className="h-screen flex items-center justify-center">
//         <div className="text-xl text-red-500">{error || "Quiz not found"}</div>
//       </div>
//     );
//   }

//   return (
//     <QuestionEditor
//       quiz={quiz}
//       updateQuiz={updateQuiz}
//       saveQuiz={saveQuiz}
//     />
//   );
// }

// function QuestionEditor({ quiz, updateQuiz, saveQuiz }) {
//   const [activeSlideIndex, setActiveSlideIndex] = useState(0);

//   // تبدیل ساختار quiz به فرمت قابل استفاده برای کامپوننت‌ها
//   const slides = quiz.slides || [];
//   const activeSlide = slides[activeSlideIndex] || null;

//   const [activeTab, setActiveTab] = useState(null);
//   const [showSidebar, setShowSidebar] = useState(false);
//   const [showDesignPanel, setShowDesignPanel] = useState(false);
//   const [showAudioPanel, setShowAudioPanel] = useState(false);
//   const [showTypeBox, setShowTypeBox] = useState(false);

//   // توابع برای مدیریت تب‌ها
//   const handleTabClick = (tabId) => {
//     if (tabId === "audio") {
//       setShowAudioPanel(prev => !prev);
//       setShowSidebar(false);
//       setShowDesignPanel(false);
//       if (showAudioPanel) {
//         setActiveTab(null);
//       } else {
//         setActiveTab(tabId);
//       }
//     } else if (tabId === "content") {
//       setShowSidebar(!showSidebar);
//       setShowDesignPanel(false);
//       setShowAudioPanel(false);
//     } else if (tabId === "design") {
//       setShowDesignPanel(!showDesignPanel);
//       setShowSidebar(false);
//       setShowAudioPanel(false);
//     } else {
//       setShowSidebar(false);
//       setShowDesignPanel(false);
//       setShowAudioPanel(false);
//     }

//     if (tabId !== "audio" || !showAudioPanel) {
//       setActiveTab(tabId);
//     }
//   };

//   const handleCloseAudioPanel = () => {
//     setShowAudioPanel(false);
//     setActiveTab(null);
//   };

//   const handleCloseDesignPanel = () => {
//     setShowDesignPanel(false);
//     setActiveTab(null);
//   };

//   const handleCloseSidebarPanel = () => {
//     setShowSidebar(false);
//     setActiveTab(null);
//   };

//   // ایجاد اسلاید جدید
//   const addNewSlide = async () => {
//     try {
//       const newSlideData = {
//         slide_type: 1,
//         order: 1,
//         show_leaderboard_after: false,
//         title: "",
//         content_text: "",
//         content_image_url: "",
//       };

//       // ارسال به سرور برای ایجاد اسلاید جدید
//       const createdSlide = await quizService.createSlide(quiz.quiz_id, newSlideData);

//       // به‌روزرسانی quiz با اسلاید جدید
//       const updatedSlides = [...slides, createdSlide];
//       updateQuiz({
//         ...quiz,
//         slides: updatedSlides
//       });

//       // انتخاب اسلاید جدید
//       setActiveSlideIndex(updatedSlides.length - 1);
//     } catch (error) {
//       console.error("Failed to create new slide:", error);
//       alert("❌ Failed to create new slide");
//     }
//   };

//       const createLeaderboardSlide = async (questionOrder) => {
//         try {
//           // ابتدا اسلاید سوال را پیدا کن (اسلاید اصلی که لیدربرد برای آن ایجاد می‌شود)
//           const questionSlide = slides.find(s =>
//             s.slide_type === 1 && s.order === questionOrder
//           );

//           if (!questionSlide) return;

//           // ساختار لیدربرد با order مشابه اسلاید سوال
//           const leaderboardSlideData = {
//             slide_type: 3,
//             order: questionSlide.order, // order مشابه اسلاید سوال
//             show_leaderboard_after: false,
//             title: "",
//             content_text: "",
//             content_image_url: "",
//           };

//           // ارسال به سرور
//           const createdLeaderboardSlide = await quizService.createSlide(
//             quiz.quiz_id,
//             leaderboardSlideData
//           );

//           // به‌روزرسانی order اسلایدهای بعدی (از جمله اسلاید سوال اصلی)
//           const updatedSlides = slides.map(slide => {
//             // برای تمام اسلایدهایی که order >= questionSlide.order دارند، order را یک واحد افزایش بده
//             if (slide.order >= questionSlide.order) {
//               return {
//                 ...slide,
//                 order: slide.order + 1
//               };
//             }
//             return slide;
//           });

//           // درج اسلاید لیدربرد بعد از اسلاید سوال (با order اصلی اسلاید سوال)
//           createdLeaderboardSlide.order = questionSlide.order; // لیدربرد order اصلی اسلاید سوال را می‌گیرد
//           const questionIndex = updatedSlides.findIndex(s =>
//             s.slide_id === questionSlide.slide_id || s.order === questionSlide.order
//           );

//           // درج لیدربرد بعد از اسلاید سوال
//           updatedSlides.splice(questionIndex + 1, 0, createdLeaderboardSlide);

//           // اعمال تغییرات
//           updateQuiz({
//             ...quiz,
//             slides: updatedSlides
//           });

//           // انتخاب اسلاید لیدربرد
//           setActiveSlideIndex(questionIndex + 1);
//         } catch (error) {
//           console.error("Failed to create leaderboard slide:", error);
//           alert("❌ Failed to create leaderboard slide");
//         }
//       };

//       // حذف اسلاید لیدربرد
//       const deleteLeaderboardSlide = async (questionOrder) => {
//         try {
//           // اسلاید لیدربرد مرتبط را پیدا کن (اسلاید لیدربردی که order آن برابر با order اسلاید سوال است)
//           const leaderboardSlide = slides.find(s =>
//             s.slide_type === 3 && s.order === questionOrder
//           );

//           if (!leaderboardSlide) return;

//           // حذف از سرور
//           await quizService.deleteSlide(quiz.quiz_id, leaderboardSlide.slide_id);

//           // حذف از state و به‌روزرسانی order اسلایدهای بعدی
//           const updatedSlides = slides
//             .filter(s => s !== leaderboardSlide) // حذف لیدربرد
//             .map(slide => {
//               // برای تمام اسلایدهایی که order > questionOrder دارند، order را یک واحد کاهش بده
//               if (slide.order > questionOrder) {
//                 return {
//                   ...slide,
//                   order: slide.order - 1
//                 };
//               }
//               return slide;
//             });

//           updateQuiz({
//             ...quiz,
//             slides: updatedSlides
//           });

//           // اگر اسلاید فعال حذف شده، به اسلاید اول برو
//           if (activeSlideIndex >= updatedSlides.length) {
//             setActiveSlideIndex(0);
//           }
//         } catch (error) {
//           console.error("Failed to delete leaderboard slide:", error);
//           alert("❌ Failed to delete leaderboard slide");
//         }
//       };

//   // حذف اسلاید
//   const deleteSlide = async (slideId) => {
//     try {
//       // حذف از سرور
//       await quizService.deleteSlide(quiz.quiz_id, slideId);

//       // به‌روزرسانی state
//       const slideIndex = slides.findIndex(s => s.slide_id === slideId);
//       const updatedSlides = slides.filter(s => s.slide_id !== slideId);

//       updateQuiz({
//         ...quiz,
//         slides: updatedSlides
//       });

//       // تنظیم اسلاید فعال
//       if (slides.length > 1) {
//         if (slideIndex >= updatedSlides.length) {
//           setActiveSlideIndex(updatedSlides.length - 1);
//         } else {
//           setActiveSlideIndex(slideIndex);
//         }
//       } else {
//         setActiveSlideIndex(0);
//       }
//     } catch (error) {
//       console.error("Failed to delete slide:", error);
//       alert("❌ Failed to delete slide");
//     }
//   };

//   // مرتب‌سازی مجدد اسلایدها
//   const reorderSlides = async (result) => {
//     if (!result.destination) return;

//     const reordered = Array.from(slides);
//     const [removed] = reordered.splice(result.source.index, 1);
//     reordered.splice(result.destination.index, 0, removed);

//     // به‌روزرسانی order اسلایدها
//     const updatedSlides = reordered.map((slide, index) => ({
//       ...slide,
//       order: index + 1
//     }));

//     // ذخیره در سرور
//     try {
//       await quizService.reorderSlides(quiz.quiz_id, updatedSlides);
//       updateQuiz({
//         ...quiz,
//         slides: updatedSlides
//       });
//     } catch (error) {
//       console.error("Failed to reorder slides:", error);
//       alert("❌ Failed to reorder slides");
//     }
//   };

//   // به‌روزرسانی اسلاید فعال
//   const updateActiveSlide = async (updatedSlide) => {
//     try {
//       // ارسال به سرور
//       const savedSlide = await quizService.updateSlide(
//         quiz.quiz_id,
//         updatedSlide.slide_id,
//         updatedSlide
//       );

//       // به‌روزرسانی state
//       const updatedSlides = slides.map(s =>
//         s.slide_id === updatedSlide.slide_id ? savedSlide : s
//       );

//       updateQuiz({
//         ...quiz,
//         slides: updatedSlides
//       });
//     } catch (error) {
//       console.error("Failed to update slide:", error);
//       alert("❌ Failed to update slide");
//     }
//   };

//   // تغییر نوع سوال
//   const handleTypeChangeClick = () => setShowTypeBox(true);

//   const handleSelectType = async (type) => {
//     if (!activeSlide || activeSlide.slide_type !== 1) return;

//     const questionType = type === "Single Choice" ? "single" : "multiple";
//     const quizId = quiz.quiz_id;
//     const slideId = activeSlide.slide_id;
//     const currentQuestion = activeSlide.question;

//     try {
//       let result;

//       if (!currentQuestion || !currentQuestion.id) {
//       // حالت 1: ایجاد سوال جدید
//         const questionData = {
//           title: "",
//           text: "New Question",
//           question_type: questionType,
//           min_point: 0,
//           max_point: 0,
//           time_limit: 0,
//           image_url: "",
//           faster_answers_more_points: false,
//           partial_scoring: false
//         };

//         result = await quizService.createQuestion(quizId, slideId, questionData);
//       } else {
//       // حالت 2: به‌روزرسانی سوال موجود
//       // فقط ارسال فیلدهای لازم برای تغییر نوع
//         const updateData = {question_type: questionType};

//       // ارسال درخواست PATCH برای به‌روزرسانی جزئی
//         result = await axios.patch(
//           `${API_BASE_URL}/quizzes/${quizId}/slides/${slideId}/question/`,
//           updateData
//         ).then(res => res.data);
//       }

//     // ادغام نتیجه با داده‌های موجود
//       const mergedQuestion = {
//         ...(currentQuestion || {}),
//         ...result,
//         question_type: questionType
//       };

//     // به‌روزرسانی state
//       const updatedSlide = {
//         ...activeSlide,
//         question: mergedQuestion
//       };

//       updateActiveSlide(updatedSlide);
//       setShowTypeBox(false);

//     } catch (error) {
//       console.error('Error:', error);

//       if (error.response?.status === 400) {
//         const errorMsg = error.response.data;

//         if (typeof errorMsg === 'string' && errorMsg.includes("already has a question")) {
//         // سوال از قبل وجود دارد، آن را دریافت و state را به‌روز کن
//           try {
//             const existingQuestion = await quizService.getQuestion(quizId, slideId);

//             const updatedSlide = {
//               ...activeSlide,
//               question: existingQuestion
//             };
//             updateActiveSlide(updatedSlide);

//           // حالا دوباره امتحان کن
//             await handleSelectTypeSimple(type);
//           } catch (err) {
//             alert('خطا در دریافت سوال موجود. لطفاً صفحه را رفرش کنید.');
//           }
//         } else {
//           alert(`خطا: ${JSON.stringify(errorMsg)}`);
//         }
//       } else {
//         alert('خطای غیرمنتظره. لطفاً دوباره امتحان کنید.');
//       }
//     }
//   };

//   // تابع Present (ذخیره و ارائه)
//   const handlePresent = () => {
//     saveQuiz();
//   };

//   // تبدیل ساختار اسلاید برای نمایش در کامپوننت‌های فعلی
//   const convertSlideForDisplay = (slide) => {
//     if (slide.slide_type === 1 && slide.question) {
//       return {
//         slide_type: 1,
//         question_id: slide.question.question_id,
//         question_text: slide.question.text || slide.question.title,
//         question_type: slide.question.question_type,
//         question_image: slide.question.image_url,
//         question_time: slide.question.time_limit,
//         max_point: slide.question.max_point,
//         min_point: slide.question.min_point,
//         scoring_type: slide.question.faster_answers_more_points ? "faster" :
//                     slide.question.partial_scoring ? "partial" : "normal",
//         backgroundColor: quiz.background_color,
//         backgroundImage: quiz.background_image_url,
//         sound: quiz.music_url,
//         options: slide.question.options.map(opt => ({
//           option_id: opt.option_id,
//           option_text: opt.text,
//           answer: opt.is_correct,
//           votes: opt.votes || 0,
//           image: opt.image_url
//         }))
//       };
//     } else if (slide.slide_type === 3) {
//       return {
//         leaderboard_title: slide.title || "Leaderboard",
//         backgroundColor: quiz.background_color,
//         backgroundImage: quiz.background_image_url,
//       };
//     }
//     return slide;
//   };

//   const displaySlide = activeSlide ? convertSlideForDisplay(activeSlide) : null;

//   return (
//     <div className="h-full flex flex-col relative pt-14">
//       {/* ----- Header -----*/}
//       <QuizHeader
//         title={quiz.title}
//         quizId={quiz.quiz_id}
//       />

//       {/* ----- Main Layout ----- */}
//       <div className="flex flex-1 overflow-hidden">
//         {/* ----- Left Panel (Slides Panel) ----- */}
//         <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/5">
//           <SlidesPanel
//             slides={slides}
//             activeSlideId={activeSlide?.slide_id}
//             setActiveSlideId={(id) => {
//               const slide = slides.find(s => s.slide_id === id);
//               if (slide) {
//                 const index = slides.indexOf(slide);
//                 setActiveSlideIndex(index);
//               }
//             }}
//             addNewSlide={async (slideData) => {
//               // فراخوانی API برای ایجاد اسلاید جدید
//               const createdSlide = await quizService.createSlide(quiz.quiz_id, slideData);

//               // به‌روزرسانی state
//               const updatedSlides = [...slides, createdSlide];
//               updateQuiz({
//                 ...quiz,
//                 slides: updatedSlides
//               });

//               // انتخاب اسلاید جدید
//               setActiveSlideIndex(updatedSlides.length - 1);
//             }}
//             deleteSlide={async (slideId) => {
//               // فراخوانی تابع deleteSlide اصلی که API را فراخوانی می‌کند
//               await deleteSlide(slideId);
//             }}
//             reorderSlides={async (result) => {
//               // این تابع توسط handleDragEnd داخلی SlidesPanel مدیریت می‌شود
//               if (result.destination) {
//                 const reordered = Array.from(slides);
//                 const [removed] = reordered.splice(result.source.index, 1);
//                 reordered.splice(result.destination.index, 0, removed);

//                 // به‌روزرسانی state
//                 updateQuiz({
//                   ...quiz,
//                   slides: reordered
//                 });
//               }
//             }}
//             idKey="slide_id"
//             titleKey={slide => getSlideTitle(slide)}
//             quizId={quiz.quiz_id}
//             quizBackground={quiz.background_color}
//             quizBackgroundImage={quiz.background_image_url}
//           />
//         </div>

//         {/* ----- Middle panel ----- */}
//         <div className="flex-1 mx-4 relative">
//           <div className="bg-white rounded-xl shadow p-2 h-full flex justify-center items-center overflow-hidden relative">
//             {/* ----- Present Button ----- */}
//             <button
//               onClick={handlePresent}
//               className="absolute top-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-600 transition z-10"
//             >
//               Present
//             </button>

//             {activeSlide?.slide_type === 1 && (
//               <button
//                 onClick={handleTypeChangeClick}
//                 className="absolute top-2 right-2 text-sm text-gray-500 hover:text-gray-700 z-10"
//               >
//                 Change Question Type
//               </button>
//             )}

//             {displaySlide ? (
//               displaySlide.slide_type === 2 ? (
//                 <div className="w-full h-full flex justify-center items-center">
//                   <LeaderboardPreview
//                     slide={displaySlide}
//                     isFullSize={!showSidebar && !showDesignPanel && !showAudioPanel}
//                   />
//                 </div>
//               ) : (
//                 <div className="w-full h-full flex justify-center items-center">
//                   <MiniResultsResultsOnly
//                     slide={displaySlide}
//                     result={{ optionsResult: displaySlide.options?.map(opt => ({
//                       option_id: opt.option_id,
//                       answer: opt.answer,
//                       votes: opt.votes
//                     })) || [] }}
//                     isFullSize={!showSidebar && !showDesignPanel && !showAudioPanel}
//                   />
//                 </div>
//               )
//             ) : (
//               <div className="text-center text-gray-400">
//                 <p className="text-lg mb-4">No slides yet</p>
//               </div>
//             )}

//             {showTypeBox && (
//               <>
//                 <div
//                   className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"
//                   onClick={() => setShowTypeBox(false)}
//                 ></div>

//                 <div className="absolute z-20 bg-white rounded-2xl shadow-2xl p-6 w-[400px] flex flex-col items-center space-y-4">
//                   <h2 className="text-xl font-bold text-pink-700">Select Question Type</h2>

//                   {["Single Choice", "Multiple Choice"].map((type) => (
//                     <button
//                       key={type}
//                       onClick={() => handleSelectType(type)}
//                       className="w-full bg-pink-500 text-white py-2 rounded-xl hover:bg-pink-600 transition"
//                     >
//                       {type}
//                     </button>
//                   ))}

//                   <button
//                     onClick={() => setShowTypeBox(false)}
//                     className="text-gray-500 text-sm hover:underline"
//                   >
//                     Cancel
//                   </button>
//                 </div>
//               </>
//             )}
//           </div>
//         </div>

//         {/* ----- Right Panels ----- */}
//         {showSidebar && activeSlide?.slide_type === 1 && (
//           <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
//             { (() => {
//                 // بررسی اینکه آیا activeSlide.question وجود دارد
//                 if (!activeSlide?.question) {
//                   return (
//                     <div className="flex flex-col items-center justify-center h-full text-center p-4">
//                       <div className="text-yellow-500 mb-2">
//                         <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
//                         </svg>
//                       </div>
//                       <p className="text-gray-700 font-medium">First, select the question type.</p>
//                     </div>
//                   );
//                 }

//                 const validQuestionTypes = ["single", "multiple"];

//                 if (!activeSlide.question.question_type || !validQuestionTypes.includes(activeSlide.question.question_type)) {
//                   return (
//                     <div className="flex flex-col items-center justify-center h-full text-center p-4">
//                       <div className="text-red-500 mb-2">
//                         <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
//                         </svg>
//                       </div>
//                       <p className="text-gray-700 font-medium">Question type is invalid.</p>
//                     </div>
//                   );
//                 }

//                 // اگر همه شرایط برقرار بود، کامپوننت Sidebar را رندر کن
//                 return (
//                   <Sidebar
//                     slide={displaySlide}
//                     setSlide={(updatedDisplaySlide) => {
//                       // تبدیل به ساختار اصلی
//                       const updatedQuestion = {
//                         ...activeSlide.question,
//                         text: updatedDisplaySlide.question_text,
//                         question_type: updatedDisplaySlide.question_type,
//                         time_limit: updatedDisplaySlide.question_time,
//                         max_point: updatedDisplaySlide.max_point,
//                         min_point: updatedDisplaySlide.min_point,
//                         faster_answers_more_points: updatedDisplaySlide.scoring_type === "faster",
//                         partial_scoring: updatedDisplaySlide.scoring_type === "partial",
//                         options: updatedDisplaySlide.options.map(opt => ({
//                           option_id: opt.option_id,
//                           text: opt.option_text,
//                           is_correct: opt.answer,
//                           votes: opt.votes,
//                           image_url: opt.image
//                         }))
//                       };

//                       const updatedSlide = {
//                         ...activeSlide,
//                         question: updatedQuestion
//                       };

//                       updateActiveSlide(updatedSlide);
//                     }}
//                     onCreateLeaderboardSlide={() =>
//                       createLeaderboardSlide(activeSlide.order)
//                     }
//                     onDeleteLeaderboardSlide={() =>
//                       deleteLeaderboardSlide(activeSlide.order)
//                     }
//                     slides={slides}
//                     onClose={handleCloseSidebarPanel}
//                   />
//                 );
//               })()
//             }
//           </div>
//         )}

//         {showDesignPanel && (
//           <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
//             {activeSlide && (
//               <DesignPanel
//                 slide={displaySlide}
//                 setSlide={updateActiveSlide}
//                 onClose={handleCloseDesignPanel}
//                 quiz={quiz}
//                 updateQuiz={updateQuiz}
//               />
//             )}
//           </div>
//         )}

//         {showAudioPanel && (
//           <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
//             {activeSlide && (
//               <AudioPanel
//                 slide={displaySlide}
//                 setSlide={updateActiveSlide}
//                 onClose={handleCloseAudioPanel}
//                 quiz={quiz}
//                 updateQuiz={updateQuiz}
//               />
//             )}
//           </div>
//         )}
//         {/* ----- RightToolbar ----- */}
//         <RightToolbar
//           activeTab={activeTab}
//           setActiveTab={handleTabClick}
//           hasQuestion={activeSlide?.slide_type === 1}
//         />
//       </div>
//     </div>
//   );
// }

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MiniResultsResultsOnly from "./MiniResultsResultsOnly";
import LeaderboardPreview from "./LeaderboardPreview";
import QuizHeader from "../../../components/QuizHeader";
import Sidebar from "./Sidebar";
import SlidesPanel from "./SlidesPanel";
import RightToolbar from "./RightToolbar";
import DesignPanel from "./DesignPanel";
import AudioPanel from "./AudioPanel";
import { quizService } from "../../../services/quizService";

export default function EditorPage() {
  const { roomId } = useParams();
  const quizId = parseInt(roomId, 10);

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // استخراج quiz_id از URL یا location state
  // const quizId = location.state?.quiz?.quiz_id ||
  //               new URLSearchParams(location.search).get('quiz_id') ||
  //               params.quizId;

  // const quizId = location.roomId?.roomId ||
  //               new URLSearchParams(location.search).get('roomId') ||
  //               params.quizId;

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!quizId) {
        setError("There is no quiz.");
        setLoading(false);
        return;
      }

      try {
        // اگر quiz_id داریم، کوئیز را از سرور بگیر
        const quizData = await quizService.getQuiz(quizId);
        setQuiz(quizData);
      } catch (err) {
        setError("Failed to load quiz");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  const updateQuiz = (updatedQuiz) => {
    setQuiz(updatedQuiz);
  };


  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-xl text-purple-700">Loading Quiz...</div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-xl text-red-500">{error || "Quiz not found"}</div>
      </div>
    );
  }

  return <QuestionEditor quiz={quiz} updateQuiz={updateQuiz} />;
}

function QuestionEditor({ quiz, updateQuiz }) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const navigate = useNavigate();

  // استفاده مستقیم از ساختار بک‌اند
  const slides = quiz.slides || [];
  const activeSlide = slides[activeSlideIndex] || null;

  const [activeTab, setActiveTab] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [showTypeBox, setShowTypeBox] = useState(false);

  // توابع برای مدیریت تب‌ها
  const handleTabClick = (tabId) => {
    if (tabId === "audio") {
      setShowAudioPanel((prev) => !prev);
      setShowSidebar(false);
      setShowDesignPanel(false);
      if (showAudioPanel) {
        setActiveTab(null);
      } else {
        setActiveTab(tabId);
      }
    } else if (tabId === "content") {
      setShowSidebar(!showSidebar);
      setShowDesignPanel(false);
      setShowAudioPanel(false);
    } else if (tabId === "design") {
      setShowDesignPanel(!showDesignPanel);
      setShowSidebar(false);
      setShowAudioPanel(false);
    } else {
      setShowSidebar(false);
      setShowDesignPanel(false);
      setShowAudioPanel(false);
    }

    if (tabId !== "audio" || !showAudioPanel) {
      setActiveTab(tabId);
    }
  };

  const handleCloseAudioPanel = () => {
    setShowAudioPanel(false);
    setActiveTab(null);
  };

  const handleCloseDesignPanel = () => {
    setShowDesignPanel(false);
    setActiveTab(null);
  };

  const handleCloseSidebarPanel = () => {
    setShowSidebar(false);
    setActiveTab(null);
  };

  // تابع کمکی برای گرفتن عنوان اسلاید
  const getSlideTitle = (slide) => {
    if (slide.slide_type === 1 && slide.question) {
      return slide.question.text || "Question Slide";
    } else if (slide.slide_type === 3) {
      return slide.title || "Leaderboard";
    }
    // return `Slide ${slide.order}`;
    return "No Question Yet";
  };

  // ایجاد اسلاید جدید
  const addNewSlide = async () => {
    try {
      // const newSlideData = {
      //   slide_type: 1,
      //   order: slides.length + 1,
      //   show_leaderboard_after: false,
      //   title: "",
      //   content_text: "",
      //   content_image_url: "",
      // };

      const newSlideData = {
        slide_type: 1,
        order: 1,
        show_leaderboard_after: false,
        title: "",
        content_text: "",
        content_image_url: "",
      };

      // ارسال به سرور برای ایجاد اسلاید جدید
      const createdSlide = await quizService.createSlide(
        quiz.quiz_id,
        newSlideData
      );

      // به‌روزرسانی quiz با اسلاید جدید
      const updatedSlides = [...slides, createdSlide];
      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      // انتخاب اسلاید جدید
      setActiveSlideIndex(updatedSlides.length - 1);
    } catch (error) {
      console.error("Failed to create new slide:", error);
      alert("❌ Failed to create new slide");
    }
  };

  // ایجاد اسلاید لیدربرد
  const createLeaderboardSlide = async (questionOrder) => {
    try {
      // ابتدا اسلاید سوال را پیدا کن
      const questionSlide = slides.find(
        (s) => s.slide_type === 1 && s.order === questionOrder
      );

      if (!questionSlide) return;

      // ساختار لیدربرد
      const leaderboardSlideData = {
        slide_type: 3,
        order: questionSlide.order,
        show_leaderboard_after: false,
        title: "",
        content_text: "",
        content_image_url: "",
      };

      // ارسال به سرور
      const createdLeaderboardSlide = await quizService.createSlide(
        quiz.quiz_id,
        leaderboardSlideData
      );

      // به‌روزرسانی order اسلایدهای بعدی
      const updatedSlides = slides.map((slide) => {
        if (slide.order >= questionSlide.order) {
          return {
            ...slide,
            order: slide.order + 1,
          };
        }
        return slide;
      });

      // درج اسلاید لیدربرد
      createdLeaderboardSlide.order = questionSlide.order;
      const questionIndex = updatedSlides.findIndex(
        (s) => s.slide_id === questionSlide.slide_id
      );

      updatedSlides.splice(questionIndex + 1, 0, createdLeaderboardSlide);

      // اعمال تغییرات
      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      // انتخاب اسلاید لیدربرد
      setActiveSlideIndex(questionIndex + 1);
    } catch (error) {
      console.error("Failed to create leaderboard slide:", error);
      alert("❌ Failed to create leaderboard slide");
    }
  };

  // حذف اسلاید لیدربرد
  const deleteLeaderboardSlide = async (questionOrder) => {
    try {
      // اسلاید لیدربرد مرتبط را پیدا کن
      const leaderboardSlide = slides.find(
        (s) => s.slide_type === 3 && s.order === questionOrder
      );

      if (!leaderboardSlide) return;

      // حذف از سرور
      await quizService.deleteSlide(quiz.quiz_id, leaderboardSlide.slide_id);

      // حذف از state و به‌روزرسانی order
      const updatedSlides = slides
        .filter((s) => s.slide_id !== leaderboardSlide.slide_id)
        .map((slide) => {
          if (slide.order > questionOrder) {
            return {
              ...slide,
              order: slide.order - 1,
            };
          }
          return slide;
        });

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      // اگر اسلاید فعال حذف شده، به اسلاید قبل برو
      if (activeSlideIndex >= updatedSlides.length) {
        setActiveSlideIndex(Math.max(0, updatedSlides.length - 1));
      }
    } catch (error) {
      console.error("Failed to delete leaderboard slide:", error);
      alert("❌ Failed to delete leaderboard slide");
    }
  };

  // حذف اسلاید
  const deleteSlide = async (slideId) => {
    try {
      // حذف از سرور
      await quizService.deleteSlide(quiz.quiz_id, slideId);

      // به‌روزرسانی state
      const slideIndex = slides.findIndex((s) => s.slide_id === slideId);
      const updatedSlides = slides.filter((s) => s.slide_id !== slideId);

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      // تنظیم اسلاید فعال
      if (updatedSlides.length > 0) {
        if (slideIndex >= updatedSlides.length) {
          setActiveSlideIndex(updatedSlides.length - 1);
        } else {
          setActiveSlideIndex(slideIndex);
        }
      } else {
        setActiveSlideIndex(0);
      }
    } catch (error) {
      console.error("Failed to delete slide:", error);
      alert("❌ Failed to delete slide");
    }
  };

  // به‌روزرسانی اسلاید فعال
  const updateActiveSlide = async (updatedSlide) => {
    try {
      // ارسال به سرور
      const savedSlide = await quizService.updateSlide(
        quiz.quiz_id,
        updatedSlide.slide_id,
        updatedSlide
      );

      // به‌روزرسانی state
      const updatedSlides = slides.map((s) =>
        s.slide_id === updatedSlide.slide_id ? savedSlide : s
      );

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });
    } catch (error) {
      console.error("Failed to update slide:", error);
      alert("❌ Failed to update slide");
    }
  };

  // تغییر نوع سوال
  const handleTypeChangeClick = () => {
    setShowTypeBox(true);
  };

  const handleSelectType = async (type) => {
    if (!activeSlide || activeSlide.slide_type !== 1) return;

    const questionType = type === "Single Choice" ? "single" : "multiple";
    const quizId = quiz.quiz_id;
    const slideId = activeSlide.slide_id;
    const currentQuestion = activeSlide.question;

    try {
      let updatedQuestion;

      if (!currentQuestion || !currentQuestion.question_id) {
        // حالت 1: ایجاد سوال جدید
        const questionData = {
          title: "",
          text: "New Question",
          question_type: questionType,
          min_point: 0,
          max_point: 100,
          time_limit: 10,
          image_url: "",
          faster_answers_more_points: false,
          partial_scoring: false,
        };

        updatedQuestion = await quizService.createQuestion(
          quizId,
          slideId,
          questionData
        );
      } else {
        // حالت 2: به‌روزرسانی سوال موجود
        const updateData = {
          ...currentQuestion,
          question_type: questionType,
        };

        updatedQuestion = await quizService.updateQuestion(
          quizId,
          slideId,
          updateData
        );
      }

      // به‌روزرسانی state
      const updatedSlide = {
        ...activeSlide,
        question: updatedQuestion,
      };

      // به‌روزرسانی در state اصلی
      const updatedSlides = slides.map((s) =>
        s.slide_id === slideId ? updatedSlide : s
      );

      updateQuiz({
        ...quiz,
        slides: updatedSlides,
      });

      setShowTypeBox(false);
    } catch (error) {
      console.error("Error changing question type:", error);

      if (error.response?.status === 400) {
        const errorMsg = error.response.data;
        alert(`Error: ${JSON.stringify(errorMsg)}`);
      } else {
        alert("Unexpected error. Please try again.");
      }
    }
  };

  // تابع برای به‌روزرسانی اسلاید پس از ذخیره در Sidebar
  const handleSlideUpdated = (updatedSlide) => {
    // به‌روزرسانی اسلاید در state اصلی
    const updatedSlides = slides.map((s) =>
      s.slide_id === updatedSlide.slide_id ? updatedSlide : s
    );

    updateQuiz({
      ...quiz,
      slides: updatedSlides,
    });

    // به‌روزرسانی اسلاید فعال
    setActiveSlideIndex(
      updatedSlides.findIndex((s) => s.slide_id === updatedSlide.slide_id)
    );
  };

  // تابع Present (ذخیره و ارائه)
  // const handlePresent = () => {
  //   saveQuiz();
  // };

  // const handlePresent = () => {
  //   navigate(`/manager/presentation/${quizId}/`);
  // };

  const handlePresent = () => {
    navigate(`/manager/presentation/${quiz.quiz_id}/`);
  };

  return (
    <div className="h-full flex flex-col relative pt-14">
      {/* ----- Header -----*/}
      <QuizHeader
        accessCode={quiz.access_code}
        quizTitle={quiz.title}
        quizId={quiz.quiz_id}
      />

      {/* ----- Main Layout ----- */}
      <div className="flex flex-1 overflow-hidden">
        {/* ----- Left Panel (Slides Panel) ----- */}
        <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/5">
          <SlidesPanel
            slides={slides}
            activeSlideId={activeSlide?.slide_id}
            setActiveSlideId={(id) => {
              const slide = slides.find((s) => s.slide_id === id);
              if (slide) {
                const index = slides.indexOf(slide);
                setActiveSlideIndex(index);
              }
            }}
            addNewSlide={addNewSlide}
            deleteSlide={deleteSlide}
            reorderSlides={async (result) => {
              if (!result.destination) return;

              const reordered = Array.from(slides);
              const [removed] = reordered.splice(result.source.index, 1);
              reordered.splice(result.destination.index, 0, removed);

              // به‌روزرسانی order اسلایدها
              const updatedSlides = reordered.map((slide, index) => ({
                ...slide,
                order: index + 1,
              }));

              // ذخیره در سرور
              try {
                await quizService.reorderSlides(quiz.quiz_id, updatedSlides);
                updateQuiz({
                  ...quiz,
                  slides: updatedSlides,
                });
              } catch (error) {
                console.error("Failed to reorder slides:", error);
                alert("❌ Failed to reorder slides");
              }
            }}
            idKey="slide_id"
            titleKey="slide_type"
            getSlideTitle={getSlideTitle}
            quizId={quiz.quiz_id}
            quizBackground={quiz.background_color}
            quizBackgroundImage={quiz.background_image_url}
          />
        </div>

        {/* ----- Middle panel ----- */}
        <div className="flex-1 mx-4 relative">
          <div className="bg-white rounded-xl shadow p-2 h-full flex justify-center items-center overflow-hidden relative">
            {/* ----- Present Button ----- */}

            <button
              onClick={handlePresent}
              className="absolute top-2 left-2 bg-gradient-to-r from-slate-500 to-teal-600 
                        hover:from-slate-600 hover:to-teal-700 text-white px-3 py-1 rounded-lg text-3xl  transition z-10"
            >
              Present
            </button>
            {activeSlide?.slide_type === 1 && (
              <button
                onClick={handleTypeChangeClick}
                className="absolute top-2 right-2 text-sm text-gray-500 hover:text-gray-700 z-10"
              >
                Change Question Type
              </button>
            )}

            {activeSlide ? (
              activeSlide.slide_type === 3 ? (
                <div className="w-full h-full flex justify-center items-center">
                  <LeaderboardPreview
                    slide={activeSlide}
                    quizBackground={quiz.background_color}
                    quizBackgroundImage={quiz.background_image_url}
                    isFullSize={
                      !showSidebar && !showDesignPanel && !showAudioPanel
                    }
                  />
                </div>
              ) : activeSlide.slide_type === 1 && activeSlide.question ? (
                <div className="w-full h-full flex justify-center items-center">
                  <MiniResultsResultsOnly
                    slide={activeSlide}
                    quizBackground={quiz.background_color}
                    quizBackgroundImage={quiz.background_image_url}
                    isFullSize={
                      !showSidebar && !showDesignPanel && !showAudioPanel
                    }
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <p className="text-lg mb-4">No content to display</p>
                  <button
                    onClick={handleTypeChangeClick}
                    className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition"
                  >
                    Select Question Type
                  </button>
                </div>
              )
            ) : (
              <div className="text-center text-gray-400">
                <p className="text-lg mb-4">No slides yet</p>
                {/* <button
                  onClick={addNewSlide}
                  className="bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition"
                >
                  Create First Slide
                </button> */}
              </div>
            )}

            {showTypeBox && (
              <>
                <div
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"
                  onClick={() => setShowTypeBox(false)}
                ></div>

                <div className="absolute z-20 bg-white rounded-2xl shadow-2xl p-6 w-[400px] flex flex-col items-center space-y-4">
                  <h2 className="text-xl font-bold text-pink-700">
                    Select Question Type
                  </h2>

                  {["Single Choice", "Multiple Choice"].map((type) => (
                    <button
                      key={type}
                      onClick={() => handleSelectType(type)}
                      className="w-full bg-pink-500 text-white py-2 rounded-xl hover:bg-pink-600 transition"
                    >
                      {type}
                    </button>
                  ))}

                  <button
                    onClick={() => setShowTypeBox(false)}
                    className="text-gray-500 text-sm hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ----- Right Panels ----- */}
        {showSidebar && activeSlide?.slide_type === 1 && (
          <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
            {(() => {
              // بررسی اینکه آیا activeSlide.question وجود دارد
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
                      className="mt-4 bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition"
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
                    <div className="text-red-500 mb-2">
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

              // اگر همه شرایط برقرار بود، کامپوننت Sidebar را رندر کن
              return (
                <Sidebar
                  quizId={quiz.quiz_id}
                  slide={activeSlide}
                  setSlide={setActiveSlideIndex}
                  onCreateLeaderboardSlide={() =>
                    createLeaderboardSlide(activeSlide.order)
                  }
                  onDeleteLeaderboardSlide={() =>
                    deleteLeaderboardSlide(activeSlide.order)
                  }
                  slides={slides}
                  onClose={handleCloseSidebarPanel}
                  onSlideUpdated={handleSlideUpdated}
                />
              );
            })()}
          </div>
        )}

        {showDesignPanel && (
          <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
            {activeSlide && (
              <DesignPanel
                quiz={quiz}
                updateQuiz={updateQuiz}
                onClose={handleCloseDesignPanel}
              />
            )}
          </div>
        )}

        {showAudioPanel && (
          <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto w-1/4">
            {activeSlide && (
              <AudioPanel
                slide={activeSlide}
                setSlide={updateActiveSlide}
                onClose={handleCloseAudioPanel}
                quiz={quiz}
                updateQuiz={updateQuiz}
              />
            )}
          </div>
        )}

        {/* ----- RightToolbar ----- */}
        <RightToolbar
          activeTab={activeTab}
          setActiveTab={handleTabClick}
          hasQuestion={activeSlide?.slide_type === 1}
        />
      </div>
    </div>
  );
}

