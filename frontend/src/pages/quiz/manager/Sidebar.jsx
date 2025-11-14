import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useCallback } from "react";
import {
  GripVertical,
  Trash2,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  X,
} from "lucide-react";

export default function Sidebar({ slide, setSlide, onCreateLeaderboardSlide, onDeleteLeaderboardSlide, slides }) {
  // تغییر متن سوال
  const handleQuestionChange = (value) => {
    setSlide({ ...slide, question_text: value });
  };

  const handleAddOption = () => {
  // ساختن ID جدید حتی اگر option_idها رشته باشند
  const newId =
    slide.options.length > 0
      ? Math.max(
          ...slide.options.map((o) =>
            isNaN(parseInt(o.option_id)) ? 0 : parseInt(o.option_id)
          )
        ) + 1
      : 1;

  const newOption = {
    option_id: newId,
    option_text: `Option ${newId}`,
    answer: false,
    image: "",
  };

  // بدون هیچ محدودیت یا بررسی خاص
  setSlide({
    ...slide,
    options: [...slide.options, newOption],
  });
};

  // حذف گزینه
  const handleDeleteOption = (id) => {
    setSlide({
      ...slide,
      options: slide.options.filter((opt) => opt.option_id !== id),
    });
  };

  // تغییر مقدار گزینه (متن، درست/نادرست یا عکس)
  const handleOptionChange = (id, field, value) => {
    setSlide({
      ...slide,
      options: slide.options.map((opt) =>
        opt.option_id === id ? { ...opt, [field]: value } : opt
      ),
    });
  };

  // انتخاب گزینه درست (فقط یکی)
  const handleSelectCorrect = (id) => {
    setSlide({
      ...slide,
      options: slide.options.map((opt) => ({
        ...opt,
        answer: opt.option_id === id,
      })),
    });
  };

  // جابه‌جایی گزینه‌ها
  const onDragEnd = useCallback(
    (result) => {
      if (!result.destination) return;
      const newOptions = Array.from(slide.options);
      const [moved] = newOptions.splice(result.source.index, 1);
      newOptions.splice(result.destination.index, 0, moved);
      setSlide({ ...slide, options: newOptions });
    },
    [slide, setSlide]
  );

  // آپلود تصویر برای سوال یا گزینه
  const handleImageUpload = (e, type, id = null) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === "question") {
        setSlide({ ...slide, question_image: reader.result });
      } else if (type === "option") {
        handleOptionChange(id, "image", reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // حذف تصویر
  const handleRemoveImage = (type, id = null) => {
    if (type === "question") {
      setSlide({ ...slide, question_image: "" });
    } else if (type === "option") {
      handleOptionChange(id, "image", "");
    }
  };

  // آپلود تصویر پس‌زمینه
  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSlide({ ...slide, backgroundImage: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const clearBackgroundImage = () => {
    setSlide({ ...slide, backgroundImage: "" });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold mb-2">Slide Settings</h2>

      {/* Question Slides Content */}
      {slide.slide_type === 1 && (
        <>
          {/* Question Text */}
          <div>
            <label className="block font-medium mb-1">Question Text:</label>
            <div className="flex items-start gap-2">
              <input
                type="text"
                value={slide.question_text || ""}
                onChange={(e) => handleQuestionChange(e.target.value)}
                className="flex-1 border rounded p-2"
              />
              <div className="flex flex-col items-center gap-1">
            {/* آیکون آپلود تصویر سؤال */}
            <label className="p-2 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200">
              <ImageIcon className="w-4 h-4 text-gray-600" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageUpload(e, "question")}
              />
            </label>
            {slide.question_image && (
              <div className="relative mt-1">
                <img
                  src={slide.question_image}
                  alt="Question"
                  className="w-16 h-16 object-cover rounded-md border"
                />
                <button
                  onClick={() => handleRemoveImage("question")}
                  className="absolute top-0 right-0 bg-white rounded-full p-0.5 text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Options */}
      <div>
        <label className="block font-medium mb-1">Options:</label>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="options">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {slide.options.map((opt, index) => (
                  <Draggable
                    key={opt.option_id}
                    draggableId={opt.option_id.toString()}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="flex items-start gap-2 mb-2 border rounded p-2 bg-white"
                      >
                        {/* آیکون درگ */}
                        <div
                          {...provided.dragHandleProps}
                          className="p-2 bg-gray-100 rounded-md cursor-grab hover:bg-gray-200"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-4 h-4 text-gray-600" />
                        </div>

                        {/* انتخاب گزینه درست */}
                        <button
                          onClick={() => handleSelectCorrect(opt.option_id)}
                          className={`p-2 rounded-md ${
                            opt.answer
                              ? "bg-green-100 text-green-600"
                              : "bg-gray-100 text-gray-500"
                          } hover:bg-green-200 transition`}
                          title="Mark as correct"
                        >
                          {opt.answer ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>

                        {/* ورودی متن گزینه */}
                        <div className="flex-1 flex flex-col gap-1">
                          <input
                            type="text"
                            value={opt.option_text}
                            onChange={(e) =>
                              handleOptionChange(
                                opt.option_id,
                                "option_text",
                                e.target.value
                              )
                            }
                            className="w-full border rounded p-2"
                          />

                          {opt.image && (
                            <div className="relative mt-1 w-fit">
                              <img
                                src={opt.image}
                                alt="Option"
                                className="w-20 h-20 object-cover rounded-md border"
                              />
                              <button
                                onClick={() =>
                                  handleRemoveImage("option", opt.option_id)
                                }
                                className="absolute top-0 right-0 bg-white rounded-full p-0.5 text-red-500"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* آپلود تصویر */}
                        <label className="p-2 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200">
                          <ImageIcon className="w-4 h-4 text-gray-600" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleImageUpload(e, "option", opt.option_id)
                            }
                          />
                        </label>

                        {/* حذف گزینه */}
                        <button
                          onClick={() => handleDeleteOption(opt.option_id)}
                          className="p-2 bg-gray-100 rounded-md hover:bg-red-100 text-red-600"
                          title="Delete option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        
        <button
          onClick={handleAddOption}
          className="
            flex items-start gap-2 
            mb-2 border rounded p-2 
          bg-white w-full 
            cursor-pointer 
          hover:bg-green-100
            transition
          "
        >
          <span className="flex-1 text-center self-center text-gray-700">
            ➕ Add Option
          </span>
        </button>

      </div>
        </>
      )}

      {/* Background Controls (only for question slides) */}
      {slide.slide_type === 1 && (
        <>
          <div>
            <label className="block font-medium mb-1">Background Color:</label>
            <input
              type="color"
              value={slide.backgroundColor || "#ffffff"}
              onChange={(e) =>
                setSlide({ ...slide, backgroundColor: e.target.value })
              }
              className="w-full h-10 cursor-pointer border rounded"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Background Image:</label>
            <div className="flex gap-2 items-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleBackgroundUpload}
                className="w-full text-sm"
              />
              <button
                onClick={clearBackgroundImage}
                className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
              >
                ✖
              </button>
            </div>
          </div>
        </>
      )}

      {/* Question Time (only for question slides) */}
      {slide.slide_type === 1 && (
        <div>
          <label className="block font-medium mb-1">Question Time (seconds):</label>
          <input
            type="number"
            min="1"
            value={slide.question_time || 10}
            onChange={(e) =>
              setSlide({ ...slide, question_time: parseInt(e.target.value) || 10 })
            }
            className="w-full border rounded p-2"
          />
          <p className="text-sm text-gray-600 mt-1">Time given to answer this question</p>
        </div>
      )}

      {/* Points (only for question slides) */}
      {slide.slide_type === 1 && (
        <div>
          <label className="block font-medium mb-2">Scoring:</label>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Max Points:</label>
              <input
                type="number"
                min="0"
                value={slide.max_point || 0}
                onChange={(e) =>
                  setSlide({ ...slide, max_point: parseInt(e.target.value) || 0 })
                }
                className="w-full border rounded p-2"
              />
              <p className="text-xs text-gray-600 mt-1">Points for answering at the start</p>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Min Points:</label>
              <input
                type="number"
                min="0"
                value={slide.min_point || 0}
                onChange={(e) =>
                  setSlide({ ...slide, min_point: parseInt(e.target.value) || 0 })
                }
                className={`w-full border rounded p-2 ${
                  !slide.faster_answers_more_points ? "bg-gray-100 cursor-not-allowed opacity-50" : ""
                }`}
                disabled={!slide.faster_answers_more_points}
              />
              <p className="text-xs text-gray-600 mt-1">Points for answering at the end</p>
            </div>
          </div>

          {/* Faster answers get more points toggle */}
          <div className="flex items-center justify-between p-3 border rounded bg-gray-50 mb-3">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <span className="text-sm font-medium">Faster answers get more points</span>
            </label>
            <input
              type="checkbox"
              checked={slide.faster_answers_more_points || false}
              onChange={(e) =>
                setSlide({ ...slide, faster_answers_more_points: e.target.checked })
              }
              className="w-5 h-5 cursor-pointer"
            />
          </div>

          {/* Partial scoring toggle */}
          <div className="flex items-center justify-between p-3 border rounded bg-gray-50">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <span className="text-sm font-medium">Partial scoring</span>
            </label>
            <input
              type="checkbox"
              checked={slide.partial_scoring || false}
              onChange={(e) =>
                setSlide({ ...slide, partial_scoring: e.target.checked })
              }
              className="w-5 h-5 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Leaderboard Toggle (only for question slides) */}
      {slide.slide_type === 1 && (
        <div className="border rounded p-3 bg-gray-50">
          <label className="flex items-center gap-3 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={slide.show_leaderboard || false}
              onChange={(e) => {
                const isChecked = e.target.checked;
                setSlide({ ...slide, show_leaderboard: isChecked });
                
                // Auto-create leaderboard slide when toggled on
                if (isChecked && onCreateLeaderboardSlide) {
                  onCreateLeaderboardSlide();
                } else if (!isChecked && onDeleteLeaderboardSlide) {
                  // Auto-delete leaderboard slide when toggled off
                  onDeleteLeaderboardSlide(slide.question_id);
                }
              }}
              className="w-5 h-5 rounded border-gray-300 cursor-pointer"
            />
            <div>
              <span className="font-medium block">Show Leaderboard</span>
              <p className="text-sm text-gray-600">Display leaderboard after this question ends</p>
            </div>
          </label>
        </div>
      )}

      {/* Leaderboard Title (only for leaderboard slides) */}
      {slide.slide_type === 2 && (
        <div>
          <label className="block font-medium mb-1">Leaderboard Title:</label>
          <input
            type="text"
            placeholder="Leaderboard"
            value={slide.leaderboard_title || ""}
            onChange={(e) =>
              setSlide({ ...slide, leaderboard_title: e.target.value })
            }
            className="w-full border rounded p-2"
          />
        </div>
      )}

    </div>
  );
}
