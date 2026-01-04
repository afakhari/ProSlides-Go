import React from "react";

export default function MiniResultsResultsOnly({
  slide,
  quizBackground,
  quizBackgroundImage,
  isFullSize = true,
}) {
  // اگر slide یا question موجود نباشد، کامپوننت چیزی رندر نکند
  if (!slide || !slide.question || !slide.question.options) {
    return null;
  }

  const question = slide.question;
  const options = question.options;

  // Calculate votes for preview
  const totalVotes = options.reduce(
    (sum, opt) => sum + (opt.votes || opt.number_of_submits || 0),
    0
  );
  const hasVotes = totalVotes > 0;

  const dynamicStyle = {
    backgroundColor: quizBackground || "#1e1e2e",
    backgroundImage: quizBackgroundImage
      ? `url(${quizBackgroundImage})`
      : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  // Scaling classes
  const containerClasses = isFullSize
    ? "aspect-[3/2] w-full max-w-[80%] h-auto max-h-[80%] rounded-xl shadow-lg overflow-hidden"
    : "aspect-[3/2] w-full max-w-[95%] h-auto max-h-[95%] rounded-xl shadow-md overflow-hidden";

  const titleSize = isFullSize ? "text-3xl" : "text-xl";
  const optionTextSize = isFullSize ? "text-lg" : "text-xs";
  const voteTextSize = isFullSize ? "text-xl" : "text-sm";
  const imageWidth = isFullSize ? "w-1/4" : "w-1/5";
  const optionImageHeight = isFullSize ? "max-h-32" : "max-h-20";

  return (
    <div
      className={`flex flex-col items-center font-sans ${containerClasses}`}
      style={dynamicStyle}
    >
      {/* Title */}
      <h2
        className={`${titleSize} font-bold text-white mb-4 mt-6 text-center px-4 shrink-0`}
      >
        {question.question_text || question.text || question.title}
      </h2>

      {/* Main Content */}
      <div className="flex flex-1 w-full min-h-0 px-4 gap-4 pb-4">
        {/* Image (Left) */}
        {question.image_url && (
          <div
            className={`flex items-center justify-center ${imageWidth} shrink-0`}
          >
            <img
              src={question.image_url}
              alt="Question"
              className="max-h-full max-w-full rounded-xl shadow-lg object-contain"
            />
          </div>
        )}

        {/* Options (Right) */}
        <div
          className={`flex justify-around items-end flex-1 min-h-0 ${
            !question.image_url ? "w-full" : ""
          }`}
        >
          {options.map((opt, index) => {
            const votes = opt.votes || opt.number_of_submits || 0;
            const height = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            const isCorrect = opt.is_correct || opt.answer;
            const hasImage = opt.image_url && opt.image_url.length > 0;

            return (
              <div
                key={index}
                className="flex flex-col items-center justify-end w-1/5 h-full"
              >
                {/* Vote Count */}
                {hasVotes && (
                  <div
                    className={`mb-1 text-center text-white font-semibold ${voteTextSize}`}
                  >
                    {votes}
                  </div>
                )}

                {/* Option Image */}
                {hasImage && (
                  <img
                    src={opt.image_url}
                    alt={opt.option_text || opt.text}
                    className={`w-3/4 h-auto ${optionImageHeight} rounded-t-lg object-contain mb-0`}
                  />
                )}

                {/* Bar */}
                <div
                  className={`w-3/4 transition-all duration-1000 
                    ${hasImage ? "rounded-b-lg" : "rounded-t-lg"}
                    ${
                      hasVotes
                        ? isCorrect
                          ? "bg-green-500"
                          : "bg-red-500"
                        : "bg-white/20 border-2 border-white/30"
                    }
                  `}
                  style={{
                    height: hasVotes ? `${Math.max(height, 5)}%` : "20%",
                  }}
                ></div>

                {/* Option Text */}
                <p
                  className={`mt-2 text-white font-semibold text-center ${optionTextSize}`}
                >
                  {opt.option_text || opt.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
