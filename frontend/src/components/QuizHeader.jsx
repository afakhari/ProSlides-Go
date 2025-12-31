// import React, { useState } from "react";
// import ShareMenu from "./ShareMenu";

// export default function QuizHeader({ accessCode = "ABC123" }) {
//   const [showShareModal, setShowShareModal] = useState(false);

//   return (
//     <>
//       <header className="fixed top-0 left-0 right-0 w-full h-14 bg-pink-200 flex items-center justify-between px-5 z-50">
//         <div className="text-white font-semibold text-base flex items-center gap-1.5 before:content-['✱'] before:text-xl">
//           ProSlides
//         </div>

//         <div className="flex items-center">
//           <button
//             onClick={() => setShowShareModal(true)}
//             className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-full transition font-medium"
//           >
//             Share
//           </button>
//         </div>
//       </header>

//       <ShareMenu
//         isOpen={showShareModal}
//         onClose={() => setShowShareModal(false)}
//         accessCode={accessCode}
//       />
//     </>
//   );
// }

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { buildApiUrl } from "../utils/api";
import { getAuthHeaders } from "../utils/auth";
import ShareMenu from "./ShareMenu";

export default function QuizHeader({
  accessCode = "ABC123",
  quizTitle = "", // مقدار پیش‌فرض برای quizTitle
  quizId,
}) {
  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // وقتی quizTitle تغییر می‌کند، newQuizTitle را هم آپدیت کن
  useEffect(() => {
    setNewQuizTitle(quizTitle || "");
  }, [quizTitle]);

  const handleUpdateQuizName = async () => {
    // بررسی وجود quizId
    if (!quizId) {
      console.error("quizId is required for updating quiz name");
      alert("خطا: شناسه کوئیز نامعتبر است");
      setIsEditing(false);
      return;
    }

    // بررسی وجود newQuizTitle و حذف فاصله‌های اضافی
    if (!newQuizTitle || typeof newQuizTitle !== "string") {
      console.error("newQuizTitle is invalid:", newQuizTitle);
      alert("لطفا یک نام معتبر وارد کنید");
      return;
    }

    const trimmedTitle = newQuizTitle.trim();

    if (!trimmedTitle || trimmedTitle === quizTitle) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    try {
      const response = await axios.patch(
        buildApiUrl(`/quizzes/${quizId}/`),
        {
          title: trimmedTitle,
        },
        {
          headers: getAuthHeaders({ "Content-Type": "application/json" }),
        }
      );

      if (response.status === 200) {
        // بروزرسانی موفقیت‌آمیز
        console.log("نام کوئیز با موفقیت تغییر کرد:", response.data);
        alert("نام کوئیز با موفقیت تغییر کرد");

        // اگر نیاز به بروزرسانی state والد دارید
        // onQuizNameUpdated?.(trimmedTitle);
      }
    } catch (error) {
      console.error("Error updating quiz name:", error);

      // بازگرداندن به نام قبلی
      setNewQuizTitle(quizTitle || "");

      // نمایش پیام خطا به کاربر
      if (error.response) {
        alert(
          `خطا در بروزرسانی: ${
            error.response.data?.message || error.response.statusText
          }`
        );
      } else if (error.request) {
        alert("خطا در ارتباط با سرور");
      } else {
        alert("خطای ناشناخته");
      }
    } finally {
      setIsUpdating(false);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setNewQuizTitle(quizTitle || "");
    setIsEditing(false);
  };

  // تابع handleInputChange برای اطمینان از مقدار معتبر
  const handleInputChange = (e) => {
    const value = e.target.value || "";
    setNewQuizTitle(value);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 w-full h-14 bg-pink-200 flex items-center justify-between px-5 z-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/manager/panel")}
            className="text-white hover:bg-white/20 p-2 rounded-full transition"
            title="Back to Home"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </button>
          <div className="text-white font-semibold text-base flex items-center gap-1.5 before:content-['✱'] before:text-xl">
            ProSlides
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-5 py-2.5 
                    bg-gradient-to-r from-yellow-400 to-red-500
                    hover:from-yellow-450 hover:to-red-600
                    text-white font-semibold rounded-xl shadow-lg shadow-pink-300/40
                    transition active:scale-95"
            >
              Change Quiz Name
            </button>
          ) : (
            // فضای ویرایش نام کوئیز
            <div className="flex items-center gap-2 bg-white rounded-xl shadow-lg shadow-gray-300/40 px-3 py-1">
              <input
                type="text"
                value={newQuizTitle || ""} // تضمین می‌کند که value همیشه string باشد
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdateQuizName();
                  if (e.key === "Escape") handleCancelEdit();
                }}
                autoFocus
                disabled={isUpdating}
                className="px-3 py-1 mb-1 mt-1 rounded-lg border border-gray-300 
                         focus:outline-none focus:ring-2 focus:ring-pink-500 
                         focus:border-transparent bg-white text-gray-800 min-w-[200px]"
                placeholder="new name"
              />

              <button
                onClick={handleUpdateQuizName}
                disabled={isUpdating || !newQuizTitle || !newQuizTitle.trim()}
                className="flex items-center justify-center w-8 h-8 
                         bg-green-500 hover:bg-green-600 text-white 
                         rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="save"
              >
                {isUpdating ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <span className="text-lg">✓</span>
                )}
              </button>

              <button
                onClick={handleCancelEdit}
                disabled={isUpdating}
                className="flex items-center justify-center w-8 h-8 
                         bg-gray-300 hover:bg-gray-400 text-gray-700 
                         rounded-lg transition disabled:opacity-50"
                title="cancel"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>
          )}

          {/* نمایش نام فعلی کوئیز وقتی در حالت ویرایش نیستیم */}
          {/* {!isEditing && quizTitle && (
            <span className="text-gray-800 font-semibold text-lg mr-2">
              current quiz name: {quizTitle}
            </span>
          )} */}

          {/* دکمه Share */}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 
                     bg-gradient-to-r from-pink-600 to-purple-700 
                     hover:from-pink-650 hover:to-purple-800
                     text-white font-semibold rounded-xl shadow-lg shadow-pink-300/40
                     transition active:scale-95"
          >
            Share
          </button>
        </div>
      </header>

      <ShareMenu
        quizId={quizId}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        accessCode={accessCode}
      />
    </>
  );
}
