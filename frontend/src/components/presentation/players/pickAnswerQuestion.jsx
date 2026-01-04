import React, { useState, useEffect } from "react";
import {
  PickAnswerQuestion_EN,
  PickAnswerQuestion_FA,
  PickAnswerResult_EN,
  PickAnswerResult_FA,
  createUserAnswer,
} from "../../../data/mockData";

const question = PickAnswerQuestion_FA;
const result = PickAnswerResult_FA;

export default function PickAnswerQuestion() {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(question.question_time);

  const options = question.options;

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
    if (selectedOptions.length > 0) setSubmitted(true);
    const finished = timeLeft + 1;
    const output = createUserAnswer(
      question.question_id,
      selectedOptions.map((item) => item.option_id),
      finished
    );
    console.log(output);
  };

  const progressPercent =
    timeLeft >= 0 ? (timeLeft / question.question_time) * 100 : 0;
  const showResults = timeLeft <= -1;

  return (
    <div className="text-white min-h-screen bg-pink-300 font-poppins p-4">
      <div className="flex flex-col items-center justify-between">
        <h1 className="text-center text-xl p-1 bg-transparent rounded-xl text-white font-medium ">
          PROSLIDES
        </h1>
        <div className="mx-4 mt-7 flex flex-col items-stretch m-auto">
          <div className=" text-3xl font-bold mb-2 text-center h-15">
            {question.question_text}
          </div>
          {/* Progress Bar */}
          <div className="min-h-auto">
            <div className="m-2.5 flex flex-col items-stretch gap-[0.5vh]">
              <div className="flex justify-between items-center text-xl font-semibold text-white px-[0.5vw] opacity-90">
                <span>{question.min_point}p</span>
                <span>{question.max_point}p</span>
              </div>

              <div className="border border-white border-2 bg-[rgba(255,255,255,0.3)] h-2 rounded-[5px] mt-[10px] mb-[20px] overflow-hidden ">
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
                  const foundOption = result.optionsResult.find(
                    (option) => option.option_id === goz.option_id
                  );
                  icon = foundOption.answer ? "✅" : "❌";

                  if (selectedOptions.includes(goz) && submitted) {
                    optionClass = foundOption.answer
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white";
                  }
                } else if (selectedOptions.includes(goz)) {
                  optionClass = "bg-[#6c2bd9]";
                }

                return (
                  <label
                    key={goz.option_id}
                    className={`bg-black/20 p-[14px] rounded-[10px] cursor-pointer 
                                  flex items-center gap-3
                                  text-[clamp(1rem,2.3vw,1.4rem)] 
                                  transition-all duration-300 
                                  mx-[10px] 
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
              className="mt-[25px] mx-[10px] w-[calc(100%-20px)] p-[14px] border-none rounded-[10px]  font-bold cursor-pointer transition-all duration-300 text-2xl bg-white text-[#6c2bd9] disabled:opacity-60 disabled:cursor-not-allowed"
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
