import { useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWebSocket } from "../../../hooks/useWebSocket";

export default function PlayerPickAnswerQuestion({ question, result }) {
  // `question` is the primary question object (type 2 incoming message)
  // `result` is optional and may come from type 8 (question results) or type 3 (options_result)
  // The ServerDataContext will supply either when available.
  if (!question) return null;
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(question.question_time);
  const startTime = useRef(Date.now());
  const { sendMessage, isConnected } = useWebSocket();

  // ⏱ تایمر
  useEffect(() => {
    if (timeLeft > -1) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => Math.round(prev * 10 - 1) / 10);
      }, 100);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const handleSelect = (option) => {
    if (submitted || timeLeft <= -1) return;
    setSelectedOptions((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  const handleSubmit = () => {
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
    timeLeft >= 0 ? (timeLeft / question.question_time) * 100 : 0;
  const showResults = timeLeft <= -1;
  const options = question.options || [];

  return (
    <div
      className="text-white h-screen w-screen bg-cover bg-center bg-no-repeat font-poppins"
      style={{ backgroundImage: "url('/src/assets/bg.jpg')" }}
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
          {/* Progress Bar */}
          <div className="min-h-auto max-w-2xl">
            <div className="m-2.5 flex flex-col items-stretch gap-[0.5vh]">
              <div className="flex justify-between items-center text-xl font-semibold text-white px-2 mt-3 opacity-90">
                <span>{question.min_point}p</span>
                <span>{question.max_point}p</span>
              </div>

              <div className="border-white border-2 bg-[rgba(255,255,255,0.3)] h-2 rounded-[5px] mt-3 mb-5 overflow-hidden ">
                <div
                  className="h-full bg-purple-600 transition-width duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-3">
              {options.map((goz) => {
                let optionClass = "";
                let icon = null;

                if (showResults) {
                  // Defensive: result or optionsResult may be undefined when results
                  // haven't arrived yet or differ in shape. Guard property access.
                  const foundOption = result?.optionsResult?.find(
                    (option) => option.option_id === goz.option_id
                  );

                  // Only set icon if we actually have a result for this option
                  if (foundOption) {
                    icon = foundOption.answer ? "✅" : "❌";

                    if (selectedOptions.includes(goz) && submitted) {
                      optionClass = foundOption.answer
                        ? "bg-green-600 text-white"
                        : "bg-red-600 text-white";
                    }
                  } else {
                    // No result for this option yet — show neutral state
                    if (selectedOptions.includes(goz) && submitted) {
                      optionClass = "bg-gray-700 text-white";
                    }
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
