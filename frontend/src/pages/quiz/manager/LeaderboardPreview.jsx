import React from "react";

export default function LeaderboardPreview({ slide }) {
  if (!slide) {
    return <div className="w-full h-full flex items-center justify-center text-gray-400">No leaderboard data</div>;
  }

  // Mock leaderboard data for preview


  // Use Tailwind classes for layout; only set dynamic background via inline style
  const containerStyle = {};
  if (slide.backgroundImage) {
    containerStyle.backgroundImage = `linear-gradient(rgba(255,255,255,0.8), rgba(255,255,255,0.8)), url(${slide.backgroundImage})`;
    containerStyle.backgroundSize = "cover";
    containerStyle.backgroundPosition = "center";
  } else if (slide.backgroundColor) {
    containerStyle.backgroundColor = slide.backgroundColor;
  }

  console.log("LeaderboardPreview rendering with slide:", slide);

  return (
    <div
      className="rounded-xl font-sans p-8 shadow-lg overflow-auto w-[900px] h-[600px] flex flex-col items-center justify-start"
      style={containerStyle}
    >
      {/* Title Section */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <h1 className="text-4xl font-bold text-center text-gray-800">
          {slide.leaderboard_title || "Leaderboard"}
        </h1>
      </div>

      {/* Players Count */}
      <div className="text-center text-gray-400 text-sm mb-8">
        0 players
      </div>

      {/* No Result Yet Message */}
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-2xl font-bold text-gray-800 mb-3">No result yet</h2>
        <p className="text-gray-600 text-center">
          The top Quiz players will be displayed here when there are results.
        </p>
      </div>
    </div>
  );
}
