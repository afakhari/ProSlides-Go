import { useRef, useState, useEffect } from "react";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { useServerData } from "../../../hooks/useServerData";

export default function PlayerPickAnswerQuestion({
  question,
  result: propResult,
  quiz,
}) {
  // همه hooks باید قبل از conditional return باشن
  const { questionResults, partialQuestionResults } = useServerData();
  const { sendMessage, isConnected } = useWebSocket();

  const questionId = question?.question_id;
  const questionTime = question?.question_time ?? 0;

  const [selectedOptions, setSelectedOptions] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(questionTime);
  const startTime = useRef(Date.now());

  // result رو از چند منبع چک کن - مستقیم از context
  const result = propResult || questionResults || partialQuestionResults;

  // لاگ برای دیباگ
  console.log(
    "[PlayerPickAnswerQuestion] question_id:",
    question?.question_id,
    "result:",
    result,
    "partialQuestionResults:",
    partialQuestionResults
  );

  // اگه question نیست، بعد از hooks برگرد

  // ⏱ تایمر دقیق با اختلاف زمان واقعی (حتی اگر تب عوض شود یا فریز شود)
  useEffect(() => {
    if (!question) return;
    startTime.current = Date.now();
    setTimeLeft(questionTime);
    // ریست کردن state ها وقتی سوال عوض میشه
    setSelectedOptions([]);
    setSubmitted(false);
  }, [question, questionId, questionTime]);

  useEffect(() => {
    if (!question) return;
    let frameId;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const elapsed = (Date.now() - startTime.current) / 1000;
      const left = Math.max(0, questionTime - elapsed);
      setTimeLeft(left);
      if (left > 0) {
        frameId = requestAnimationFrame(tick);
      }
    };
    tick();
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [question, questionId, questionTime]);

  const handleSelect = (option) => {
    if (submitted || timeLeft <= -1) return;

    // اگر has_multiple فالس باشد، فقط یک گزینه مجاز است
    if (question.has_multiple === false) {
      // اگر گزینه قبلاً انتخاب شده، پاک می‌کنیم (toggle off)
      setSelectedOptions((prev) => (prev.includes(option) ? [] : [option]));
    } else {
      // اگر has_multiple ترو یا تعریف نشده باشد، رفتار قبلی (چند انتخابی)
      setSelectedOptions((prev) =>
        prev.includes(option)
          ? prev.filter((item) => item !== option)
          : [...prev, option]
      );
    }
  };

  const handleSubmit = () => {
    if (!question) return;
    // mark submitted for UI
    if (selectedOptions.length > 0) setSubmitted(true);

    // Get user_id from localStorage (set during registration)
    let userId = localStorage.getItem("user_id");
    if (!userId) {
      console.warn("Player user_id not found in localStorage - using fallback");
      // Fallback: generate a temporary user_id if not registered
      userId = "player_" + Math.random().toString(36).substring(2, 11);
      localStorage.setItem("user_id", userId);
    }

    // Calculate submit_time: elapsed time since question started
    const elapsedSeconds = (Date.now() - startTime.current) / 1000;

    // Build answer payload in exact format required by server
    const answer = {
      type: 4,
      question_id: question.question_id,
      user_id: userId,
      submit_time: Math.round(elapsedSeconds * 1000) / 1000, // round to 3 decimals
      options_result: question.options.map((opt) => ({
        option_id: opt.option_id,
        picked: selectedOptions.some((s) => s.option_id === opt.option_id),
      })),
    };

    console.log("Player submit:", answer);

    // Attempt to send via WebSocket; sendMessage returns false if socket not open
    if (isConnected) {
      const ok = sendMessage(answer);
      if (!ok) {
        console.warn("WebSocket not connected - submit not sent yet");
      }
    } else {
      // Demo/fallback: just log if not connected
      console.log(
        "Demo mode: answer logged but not sent (WebSocket not connected)"
      );
    }
  };

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft <= -1 && !submitted) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const progressPercent =
    timeLeft >= 0 && questionTime > 0 ? (timeLeft / questionTime) * 100 : 0;
  // نمایش جواب‌ها اگر تایمر تمام شد یا داده result رسید
  const showResults = timeLeft <= -1 || !!result;
  const options = question?.options || [];

  // Calculate dynamic background style from quiz data
  const backgroundStyle = {
    backgroundImage: quiz?.background?.image
      ? `url('${quiz.background.image}')`
      : "none",
    backgroundColor: quiz?.background?.color || "#1e1e2e",
  };

  if (!question) return null;

  return (
    <div
      className="text-white h-screen w-screen bg-cover bg-center bg-no-repeat font-poppins"
      style={backgroundStyle}
    >
      <header>
        <div className="flex items-center justify-center text-white px-6 py-7 rounded-t-xl placeholder-gray-500">
          <div className="shrink-0">
            <p className="text-3xl">Proslides</p>
          </div>
        </div>
      </header>
      <div className="flex flex-col items-center justify-between">
        {/* <h1 className="text-center text-xl p-1 bg-transparent rounded-xl text-white font-medium ">
          PROSLIDES
        </h1> */}
        <div className="mx-4 mt-7 flex flex-col items-stretch m-auto">
          <div className=" text-3xl font-bold mb-2 text-center h-15">
            {question.question_text}
          </div>
          {/* تصویر سوال */}
          {question.image_url && (
            <div className="mb-4 flex justify-center">
              <img
                src={question.image_url}
                alt="Question"
                className="max-h-36 max-w-xs rounded-xl shadow-lg object-contain"
              />
            </div>
          )}
          {/* Progress Bar */}
          <div className="min-h-auto max-w-2xl">
            <div className="m-2.5 flex flex-col items-stretch gap-[0.5vh]">
              <div className="flex justify-between items-center text-xl font-semibold text-white px-2 mt-3 opacity-90">
                <span>{question.min_point}p</span>
                <span>{question.max_point}p</span>
              </div>

              <div className="border-white border-2 bg-[rgba(255,255,255,0.3)] h-2 rounded-[5px] mt-3 mb-5 overflow-hidden">
                <div
                  className="h-full bg-purple-600"
                  style={{
                    width: "100%",
                    // Use GPU-accelerated transform instead of animating width.
                    transform: `scaleX(${Math.max(
                      0,
                      Math.min(1, progressPercent / 100)
                    )})`,
                    transformOrigin: "left",
                    transition: "transform 120ms linear",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    WebkitTransform: `scaleX(${Math.max(
                      0,
                      Math.min(1, progressPercent / 100)
                    )})`,
                    WebkitTransformOrigin: "left",
                  }}
                ></div>
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-3">
              {options.map((goz) => {
                let optionClass = "";
                let icon = null;

                if (showResults && result?.optionsResult) {
                  // نتیجه از type:3 میاد با فرمت { option_id, answer: true/false }
                  // مقایسه با تبدیل به string برای اطمینان
                  const foundOption = result.optionsResult.find(
                    (option) =>
                      String(option.option_id) === String(goz.option_id)
                  );

                  // جواب صحیح از سرور (type:3)
                  const isCorrect = foundOption?.answer === true;

                  // نمایش آیکون بر اساس جواب از سرور
                  icon = isCorrect ? "✅" : "❌";

                  if (selectedOptions.includes(goz) && submitted) {
                    optionClass = isCorrect
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white";
                  }
                } else if (selectedOptions.includes(goz)) {
                  optionClass = "bg-[#6c2bd9]";
                }

                return (
                  <label
                    key={goz.option_id}
                    className={`bg-black/20 p-4 rounded-[10px] cursor-pointer 
                                  flex items-center gap-3
                                  text-[clamp(1rem,2.3vw,1.4rem)] 
                                  transition-all duration-300 
                                  mx-3 
                                  border-solid border-white border-2 hover:bg-black/30 ${optionClass}`}
                    onClick={() => handleSelect(goz)}
                  >
                    <span className="w-6 h-6 border-2 border-white rounded-full inline-flex shrink-0 items-center justify-center relative">
                      {selectedOptions.includes(goz) && !showResults && (
                        <span className="w-[22px] h-[22px] bg-[#393e3a] rounded-full"></span>
                      )}
                      {icon && (
                        <span className="text-sm text-white absolute">
                          {icon}
                        </span>
                      )}
                    </span>
                    {/* تصویر گزینه */}
                    {goz.image_url && (
                      <img
                        src={goz.image_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    )}
                    {goz.option_text}
                  </label>
                );
              })}
            </div>

            <button
              className="mt-[25px] mx-3 w-[calc(100%-20px)] p-4 border-none rounded-[10px]  font-bold cursor-pointer transition-all duration-300 text-2xl bg-white text-[#6c2bd9] disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={
                selectedOptions.length === 0 || timeLeft <= -1 || submitted
              }
            >
              {submitted ? "Submitted ✅" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
