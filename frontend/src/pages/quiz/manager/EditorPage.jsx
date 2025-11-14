import { useState, useEffect } from "react";
import MiniResultsResultsOnly from "./MiniResultsResultsOnly";
import LeaderboardPreview from "./LeaderboardPreview";
import QuizHeader from "../../../components/QuizHeader";
import Sidebar from "./Sidebar";
import QRSidebar from "../../../components/QRSidebar";
import SlidesPanel from "./SlidesPanel";
import {DefaultGameCode} from "../../../data/mockData";


export default function EditorPage() {
  const [step, setStep] = useState("select"); // حالت‌ها: "select" یا "edit"
  const [selectedQuestionType, setSelectedQuestionType] = useState(null);

  const handleSelectType = (type) => {
    console.log("Selected:", type);

    setSelectedQuestionType(type);

    setStep("edit");
  };

  return (
    <div className="h-screen p-4 bg-gray-50 relative overflow-hidden">
      {step === "select" ? (
        <FullScreenTypeSelect onSelect={handleSelectType} />
      ) : (
        <QuestionEditor onBack={() => setStep("select")}  
        selectedQuestionType={selectedQuestionType}/>
      )}
    </div>
  );
}

/* ——— فول‌اسکرین انتخاب نوع سؤال ——— */
function FullScreenTypeSelect({ onSelect }) {
  return (
    <>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"></div>

      <div className="absolute z-20 inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md space-y-4 text-center">
          <h2 className="text-2xl font-bold text-pink-700 mb-4">
            Select Question Type
          </h2>

          {["Multiple Choice", "True / False", "Poll", "Open Question"].map(
            (type) => (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className="w-full bg-pink-500 text-white py-2 rounded-xl hover:bg-pink-600 transition"
              >
                {type}
              </button>
            )
          )}
        </div>
      </div>
    </>
  );
}


function QuestionEditor({ selectedQuestionType }) {
  const [slides, setSlides] = useState(() => {
    const saved = localStorage.getItem("slides");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn("Invalid slides data, resetting...");
      }
    }

    return [
      {
        slide_type: 1,
        question_id: 1,
        question_text: "What is the capital of France?",
        question_type: "",
        question_image: "",
        question_time: 20,
        max_point: 100,
        min_point: 0,
        backgroundColor: "#ffffff",
        backgroundImage: "",
        options: [
          { option_id: 72, option_text: "Berlin", answer: false, votes: 6, image: "" },
          { option_id: 73, option_text: "Madrid", answer: false, votes: 4, image: "" },
          { option_id: 74, option_text: "Paris", answer: true, votes: 9, image: "" },
          { option_id: 75, option_text: "Rome", answer: false, votes: 7, image: "" },
        ],
      },
    ];
  });

  const result = {
    optionsResult: [
      { option_id: 72, answer: false, votes: 6 },
      { option_id: 73, answer: false, votes: 4 },
      { option_id: 74, answer: true, votes: 9 },
      { option_id: 75, answer: false, votes: 5 },
    ],
  };

  const [activeSlideId, setActiveSlideId] = useState(slides[0]?.question_id || null);
  const activeSlide = slides.find((s) => s.question_id === activeSlideId);

  const [showQRModal, setShowQRModal] = useState(false);
  const gameCode = DefaultGameCode;

  const saveSlides = () => {
    localStorage.setItem("slides", JSON.stringify(slides));
    alert("✅ Quiz saved successfully!");
  };

  const updateActiveSlide = (updatedSlide) => {
    setSlides((prev) =>
      prev.map((s) => (s.question_id === activeSlideId ? updatedSlide : s))
    );
  };

  const addNewSlide = () => {
    const newId = slides.length ? Math.max(...slides.map((s) => s.question_id)) + 1 : 1;

    const newSlide = {
      slide_type: 1,
      question_id: newId,
      question_text: "New Question",
      question_type: "",
      question_image: "",
      question_time: 10,
      max_point: 50,
      min_point: 0,
      backgroundColor: "#ffffff",
      backgroundImage: "",
      options: [
        { option_id: 1, option_text: "Option 1", answer: false, vote: 0, image: "" },
        { option_id: 2, option_text: "Option 2", answer: true, vote: 0, image: "" },
      ],
    };

    setSlides([...slides, newSlide]);
    setActiveSlideId(newId);
  };

  const createLeaderboardSlide = () => {
    const newId = slides.length ? Math.max(...slides.map((s) => s.question_id)) + 1 : 1;

    const leaderboardSlide = {
      slide_type: 2,
      question_id: newId,
      leaderboard_title: "Leaderboard",
      backgroundColor: "#ffffff",
      backgroundImage: "",
      linked_question_id: activeSlideId,
    };

    console.log("Creating leaderboard slide with ID:", newId, leaderboardSlide);

    // Insert leaderboard slide right after the active question slide
    setSlides((prev) => {
      const activeIndex = prev.findIndex((s) => s.question_id === activeSlideId);
      console.log("Active slide index:", activeIndex, "Active ID:", activeSlideId);
      if (activeIndex !== -1) {
        const newSlides = [...prev];
        newSlides.splice(activeIndex + 1, 0, leaderboardSlide);
        console.log("Inserted at index", activeIndex + 1, "New slides:", newSlides);
        return newSlides;
      }
      return [...prev, leaderboardSlide];
    });

    console.log("Setting active slide ID to:", newId);
    setActiveSlideId(newId);
  };

  const deleteLeaderboardSlide = (linkedQuestionId) => {
    setSlides((prev) => {
      const filteredSlides = prev.filter(
        (s) => !(s.slide_type === 2 && s.linked_question_id === linkedQuestionId)
      );
      return filteredSlides;
    });
  };

  const deleteSlide = (id) => {
    const newSlides = slides.filter((s) => s.question_id !== id);
    setSlides(newSlides);

    if (activeSlideId === id && newSlides.length) {
      setActiveSlideId(newSlides[0].question_id);
    } else if (!newSlides.length) {
      setActiveSlideId(null);
    }
  };

  const reorderSlides = (result) => {
    if (!result.destination) return;

    const reordered = Array.from(slides);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);

    setSlides(reordered);
  };

  useEffect(() => {
    localStorage.setItem("slides", JSON.stringify(slides));
  }, [slides]);

  const [showTypeBox, setShowTypeBox] = useState(false);

  const handleTypeChangeClick = () => setShowTypeBox(true);

  const handleSelectType = (type) => {
    console.log("Selected question type:", type);

    updateActiveSlide({
      ...activeSlide,
      question_type: type,
    });

    setShowTypeBox(false);
  };

  // اضافه شدن بخش جدید — اعمال question_type انتخاب‌شده از صفحه اول
  useEffect(() => {
    if (selectedQuestionType && activeSlide) {
      updateActiveSlide({
        ...activeSlide,
        question_type: selectedQuestionType,
      });
    }
  }, [selectedQuestionType]);


  return (
    <div className="h-full grid grid-cols-[0.8fr_2fr_1fr] gap-4 relative pt-14">
      
      <QuizHeader
        gameCode={gameCode}
        showQRButton={true}
        onQRToggle={setShowQRModal}
        isQROpen={showQRModal}
      />
      
      <QRSidebar
        gameCode={gameCode}
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
      />

      <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto">
        <SlidesPanel
          slides={slides}
          activeSlideId={activeSlideId}
          setActiveSlideId={setActiveSlideId}
          addNewSlide={addNewSlide}
          deleteSlide={deleteSlide}
          reorderSlides={reorderSlides}
          idKey="question_id"
          titleKey="question_text"
        />
      </div>

      <div className="bg-white rounded-xl shadow p-4 relative flex flex-col justify-center items-center overflow-auto">

        {/* 🔵 دکمه پرزنت — بالا سمت چپ */}
        <button
          onClick={saveSlides}
          className="absolute top-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-blue-600 transition z-10"
        >
          Present
        </button>

        <button
          onClick={handleTypeChangeClick}
          className="absolute top-2 right-2 text-sm text-gray-500 hover:text-gray-700 z-10"
        >
          Change Question Type
        </button>

        {activeSlide ? (
          activeSlide.slide_type === 2 ? (
            <LeaderboardPreview slide={activeSlide} />
          ) : (
            <MiniResultsResultsOnly slide={activeSlide} result={result} />
          )
        ) : (
          <p className="text-gray-400">No slide selected</p>
        )}

        {showTypeBox && (
          <>
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10"
              onClick={() => setShowTypeBox(false)}
            ></div>

            <div className="absolute z-20 bg-white rounded-2xl shadow-2xl p-6 w-[400px] flex flex-col items-center space-y-4">
              <h2 className="text-xl font-bold text-pink-700">Select Question Type</h2>

              {["Multiple Choice", "True / False", "Poll", "Open Question"].map((type) => (
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

      <div className="bg-white rounded-xl shadow p-4 h-full overflow-y-auto">
        {activeSlide && (
          <Sidebar 
            slide={activeSlide} 
            setSlide={updateActiveSlide}
            onCreateLeaderboardSlide={createLeaderboardSlide}
            onDeleteLeaderboardSlide={deleteLeaderboardSlide}
            slides={slides}
          />
        )}
      </div>
    </div>
  );
}
