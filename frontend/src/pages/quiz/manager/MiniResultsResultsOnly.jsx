import React from "react";

export default function MiniResultsResultsOnly({ slide }, result) {
  const maxVotes = Math.max(...slide.options.map((o) => o.votes || 1));

  const style = {
    width: "900px",
    height: "600px",
    backgroundColor: slide.backgroundColor || "#ffffff",
    backgroundImage: slide.backgroundImage ? `url(${slide.backgroundImage})` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <div
      className="flex flex-col items-center justify-around rounded-xl font-sans p-4 shadow-lg"
      style={style}
    >
      {/* -------------- Question Section -------------- */}
      <div className="flex flex-row items-center w-full max-w-full px-4 mb-6">
        {slide.question_image && (
          <img
            src={slide.question_image}
            alt="question"
            className="w-32 h-32 object-contain rounded-lg shadow-md mr-4 shrink-0"
          />
        )}

        <h1 className="text-2xl font-bold text-left wrap-break-words overflow-hidden">
          {slide.question_text}
        </h1>
      </div>

      {/* -------------- Options Section -------------- */}
      <div className="flex justify-around items-end w-full h-[250px] px-2">
        {slide.options.map((opt) => {
          const height = ((opt.votes || 0) / maxVotes) * 100;

          return (
            <div
              key={opt.option_id}
              className="flex flex-col items-center justify-end w-1/5 h-full"
            >
              {/* Fixed-size container for option image (prevents width & height changes) */}
              <div className="w-16 h-16 flex items-center justify-center mb-2 overflow-hidden">
                {opt.image && (
                  <img
                    src={opt.image}
                    alt={opt.option_text}
                    className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                  />
                )}
              </div>

              {opt.votes !== undefined && (
                <div className="mb-2 text-center text-lg font-semibold text-gray-700">
                  {opt.votes}
                </div>
              )}

              <div
                className={`w-3/4 rounded-t-lg ${
                  opt.answer ? "bg-green-500" : "bg-pink-600"
                }`}
                style={{ height: `${height}%` }}
              ></div>

              <p className="mt-2 text-center wrap-break-words text-sm">
                {opt.option_text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
