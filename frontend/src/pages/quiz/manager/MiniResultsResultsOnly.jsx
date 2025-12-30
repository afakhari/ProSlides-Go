// import React from "react";

// export default function MiniResultsResultsOnly({ slide, result, isFullSize = true }) {
//   const maxVotes = Math.max(...slide.options.map((o) => o.votes || 1));

//   const dynamicStyle = {
//     backgroundColor: slide.backgroundColor || "#ffffff",
//     backgroundImage: slide.backgroundImage ? `url(${slide.backgroundImage})` : "none",
//     backgroundSize: "cover",
//     backgroundPosition: "center",
//   };

//   // کلاس‌های مختلف بر اساس isFullSize
//   const containerClasses = isFullSize
//     ? "aspect-[3/2] w-full max-w-[80%] h-auto max-h-[80%] rounded-xl p-4 shadow-lg"
//     : "aspect-[3/2] w-full max-w-[95%] h-auto max-h-[95%] rounded-xl p-3 shadow-md";

//   const questionTextClasses = isFullSize
//     ? "text-2xl font-bold"
//     : "text-xl font-bold";

//   const optionImageClasses = isFullSize
//     ? "w-16 h-16 mb-2"
//     : "w-12 h-12 mb-1";

//   const optionVoteClasses = isFullSize
//     ? "text-lg font-semibold mb-2"
//     : "text-base font-semibold mb-1";

//   const optionTextClasses = isFullSize
//     ? "text-sm mt-2"
//     : "text-xs mt-1";

//   return (
//     <div
//       className={`flex flex-col items-center justify-around font-sans ${containerClasses}`}
//       style={dynamicStyle}
//     > 
//       {/* -------------- Question Section -------------- */}
//       <div className={`flex flex-row items-center w-full max-w-full px-4 ${isFullSize ? 'mb-6' : 'mb-4'}`}>
//         {slide.question_image && (
//           <img
//             src={slide.question_image}
//             alt="question"
//             className={`object-contain rounded-lg shadow-md mr-4 flex-shrink-0 ${isFullSize ? 'w-32 h-32' : 'w-24 h-24'}`}
//           />
//         )}

//         <h1 className={`text-left break-words overflow-hidden ${questionTextClasses}`}>
//           {slide.question_text}
//         </h1>
//       </div>

//       {/* -------------- Options Section -------------- */}
//       <div className="flex justify-around items-end w-full h-1/2 px-2">
//         {slide.options.map((opt) => {
//           const height = ((opt.votes || 0) / maxVotes) * 100;

//           return (
//             <div
//               key={opt.option_id}
//               className="flex flex-col items-center justify-end w-1/5 h-full"
//             >
//               {/* Image container */}
//               <div className={`flex items-center justify-center overflow-hidden ${optionImageClasses}`}>
//                 {opt.image && (
//                   <img
//                     src={opt.image}
//                     alt={opt.option_text}
//                     className="max-w-full max-h-full object-contain rounded-md shadow-sm"
//                   />
//                 )}
//               </div>

//               {opt.votes !== undefined && (
//                 <div className={`text-center text-gray-700 ${optionVoteClasses}`}>
//                   {opt.votes}
//                 </div>
//               )}

//               <div
//                 className={`w-3/4 rounded-t-lg ${
//                   opt.answer ? "bg-green-500" : "bg-pink-600"
//                 }`}
//                 style={{ height: `${height}%` }}
//               ></div>

//               <p className={`text-center break-words ${optionTextClasses}`}>
//                 {opt.option_text}
//               </p>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }






// import React from "react";

// export default function MiniResultsResultsOnly({ slide, result, isFullSize = true }) {
//   const maxVotes = Math.max(...slide.options.map((o) => o.votes || 1));

//   const dynamicStyle = {
//     backgroundColor: slide.backgroundColor || "#ffffff",
//     backgroundImage: slide.backgroundImage ? `url(${slide.backgroundImage})` : "none",
//     backgroundSize: "cover",
//     backgroundPosition: "center",
//   };

//   // کلاس‌های مختلف بر اساس isFullSize
//   const containerClasses = isFullSize
//     ? "aspect-[3/2] w-full max-w-[80%] h-auto max-h-[80%] rounded-xl p-4 shadow-lg"
//     : "aspect-[3/2] w-full max-w-[95%] h-auto max-h-[95%] rounded-xl p-3 shadow-md";

//   const questionTextClasses = isFullSize
//     ? "text-2xl font-bold"
//     : "text-xl font-bold";

//   const optionImageClasses = isFullSize
//     ? "w-16 h-16 mb-2"
//     : "w-12 h-12 mb-1";

//   const optionVoteClasses = isFullSize
//     ? "text-lg font-semibold mb-2"
//     : "text-base font-semibold mb-1";

//   const optionTextClasses = isFullSize
//     ? "text-sm mt-2"
//     : "text-xs mt-1";

//   return (
//     <div
//       className={`flex flex-col items-center justify-around font-sans ${containerClasses}`}
//       style={dynamicStyle}
//     > 
//       {/* -------------- Question Section -------------- */}
//       <div className={`relative flex items-center w-full max-w-full px-4 ${isFullSize ? 'mb-6' : 'mb-4'}`}>
//         {slide.question_image && (
//           <img
//             src={slide.question_image}
//             alt="question"
//             className={`absolute left-4 object-contain rounded-lg shadow-md flex-shrink-0 ${isFullSize ? 'w-32 h-32' : 'w-24 h-24'}`}
//           />
//         )}

//         {/* Container for centered text */}
//         <div className="w-full flex justify-center">
//           <h1 className={`text-center break-words overflow-hidden ${questionTextClasses} ${
//             slide.question_image 
//               ? isFullSize 
//                 ? 'ml-32' // Adjust margin when image exists
//                 : 'ml-24'
//               : ''
//           }`}>
//             {slide.question_text}
//           </h1>
//         </div>
//       </div>

//       {/* -------------- Options Section -------------- */}
//       <div className="flex justify-around items-end w-full h-1/2 px-2">
//         {slide.options.map((opt) => {
//           const height = ((opt.votes || 0) / maxVotes) * 100;

//           return (
//             <div
//               key={opt.option_id}
//               className="flex flex-col items-center justify-end w-1/5 h-full"
//             >
//               {/* Image container */}
//               <div className={`flex items-center justify-center overflow-hidden ${optionImageClasses}`}>
//                 {opt.image && (
//                   <img
//                     src={opt.image}
//                     alt={opt.option_text}
//                     className="max-w-full max-h-full object-contain rounded-md shadow-sm"
//                   />
//                 )}
//               </div>

//               {opt.votes !== undefined && (
//                 <div className={`text-center text-gray-700 ${optionVoteClasses}`}>
//                   {opt.votes}
//                 </div>
//               )}

//               <div
//                 className={`w-3/4 rounded-t-lg ${
//                   opt.answer ? "bg-green-500" : "bg-pink-600"
//                 }`}
//                 style={{ height: `${height}%` }}
//               ></div>

//               <p className={`text-center break-words ${optionTextClasses}`}>
//                 {opt.option_text}
//               </p>
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }









import React from "react";

export default function MiniResultsResultsOnly({ slide, quizBackground, quizBackgroundImage, isFullSize = true }) {
  // اگر slide یا question موجود نباشد، کامپوننت چیزی رندر نکند
  if (!slide || !slide.question || !slide.question.options) {
    return null;
  }

  // استخراج گزینه‌ها از slide.question.options
  const options = slide.question.options;
  const maxVotes = Math.max(...options.map((o) => o.votes || 1));

  // استفاده از پس‌زمینه از quiz سطح بالا (که در slide نیست)
  // در اینجا فرض می‌کنیم backgroundColor و backgroundImage از props جداگانه می‌آیند
  // یا از parent کامپوننت منتقل می‌شوند
  // const dynamicStyle = {
  //   backgroundColor: slide.backgroundColor || "#ffffff",
  //   backgroundImage: slide.backgroundImage ? `url(${slide.backgroundImage})` : "none",
  //   backgroundSize: "cover",
  //   backgroundPosition: "center",
  // };

  const dynamicStyle = {
    backgroundColor: quizBackground || "#ffffff",
    backgroundImage: quizBackgroundImage ? `url(${quizBackgroundImage})` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };




  // کلاس‌های مختلف بر اساس isFullSize
  const containerClasses = isFullSize
    ? "aspect-[3/2] w-full max-w-[80%] h-auto max-h-[80%] rounded-xl p-4 shadow-lg"
    : "aspect-[3/2] w-full max-w-[95%] h-auto max-h-[95%] rounded-xl p-3 shadow-md";

  const questionTextClasses = isFullSize
    ? "text-2xl font-bold"
    : "text-xl font-bold";

  const optionImageClasses = isFullSize
    ? "w-16 h-16 mb-2"
    : "w-12 h-12 mb-1";

  const optionVoteClasses = isFullSize
    ? "text-lg font-semibold mb-2"
    : "text-base font-semibold mb-1";

  const optionTextClasses = isFullSize
    ? "text-sm mt-2"
    : "text-xs mt-1";

  return (
    <div
      className={`flex flex-col items-center justify-around font-sans ${containerClasses}`}
      style={dynamicStyle}
    > 
      {/* -------------- Question Section -------------- */}
      <div className={`relative flex items-center w-full max-w-full px-4 ${isFullSize ? 'mb-6' : 'mb-4'}`}>
        {slide.question.image_url && (
          <img
            src={slide.question.image_url}
            alt="question"
            className={`absolute left-4 object-contain rounded-lg shadow-md flex-shrink-0 ${isFullSize ? 'w-32 h-32' : 'w-24 h-24'}`}
          />
        )}

        {/* Container for centered text */}
        <div className="w-full flex justify-center">
          <h1 className={`text-center break-words overflow-hidden ${questionTextClasses} ${
            slide.question.image_url 
              ? isFullSize 
                ? 'ml-32' // Adjust margin when image exists
                : 'ml-24'
              : ''
          }`}>
            {slide.question.text || slide.question.title}
          </h1>
        </div>
      </div>

      {/* -------------- Options Section -------------- */}
      <div className="flex justify-around items-end w-full h-1/2 px-2">
        {options.map((opt) => {
          const height = ((opt.votes || 0) / maxVotes) * 100;

          return (
            <div
              key={opt.option_id}
              className="flex flex-col items-center justify-end w-1/5 h-full"
            >
              {/* Image container */}
              <div className={`flex items-center justify-center overflow-hidden ${optionImageClasses}`}>
                {opt.image_url && (
                  <img
                    src={opt.image_url}
                    alt={opt.text}
                    className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                  />
                )}
              </div>

              {opt.votes !== undefined && (
                <div className={`text-center text-gray-700 ${optionVoteClasses}`}>
                  {opt.votes}
                </div>
              )}

              <div
                className={`w-3/4 rounded-t-lg ${
                  opt.is_correct ? "bg-green-500" : "bg-pink-600"
                }`}
                style={{ height: `${height}%` }}
              ></div>

              <p className={`text-center break-words ${optionTextClasses}`}>
                {opt.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}