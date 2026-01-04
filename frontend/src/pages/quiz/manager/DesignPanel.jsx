import React, { useState, useEffect } from "react";
import { Palette, X, Upload, Trash2, Save, Link } from "lucide-react";
import { quizService } from "../../../services/quizService"; 


export default function DesignPanel({ quiz, updateQuiz, onClose }) {
  const [activeTab, setActiveTab] = useState("color");
  const [localQuiz, setLocalQuiz] = useState({ ...quiz });
  const [hasChanges, setHasChanges] = useState(false);
  const [originalQuiz, setOriginalQuiz] = useState({ ...quiz });
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // تنظیم مقادیر اولیه
  useEffect(() => {
    setOriginalQuiz({ ...quiz });
    setLocalQuiz({ ...quiz });
    // اگر background_image_url موجود است
    if (quiz.background_image_url) {
      setImageUrl(quiz.background_image_url);
      setPreview(quiz.background_image_url);
    }
  }, [quiz]);

  // تشخیص تغییرات
  useEffect(() => {
    const hasBgColorChanged = localQuiz.background_color !== originalQuiz.background_color;
    const hasBgImageChanged = localQuiz.background_image_url !== originalQuiz.background_image_url;
    
    setHasChanges(hasBgColorChanged || hasBgImageChanged);
  }, [localQuiz, originalQuiz]);


  const testImageLoad = () => {
    if (!imageUrl.trim()) {
      setError("Please enter the link");
      return;
    }

    if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
      setError("The link must start with http:// or https://");
      return;
    }

    setLoading(true);
    setError("");

    const img = new window.Image();
    
    img.onload = () => {
      setPreview(imageUrl);
      setLocalQuiz({
        ...localQuiz,
        background_image_url: imageUrl,
        // وقتی عکس انتخاب می‌شود، background_color را undefined می‌گذاریم تا در API فرستاده نشود
      });
      setLoading(false);
    };
    
    img.onerror = () => {
      setError("Invalid image link or cannot be loaded");
      setPreview(null);
      setLocalQuiz({
        ...localQuiz,
        background_image_url: "",
        background_color: localQuiz.background_color || "#ffffff",
      });
      setLoading(false);
    };
    
    img.src = imageUrl;

    // تایم‌اوت برای تست
    setTimeout(() => {
      if (!img.complete) {
        setError("Image loading took too long. Please try another link");
        setLoading(false);
      }
    }, 5000);
  };










  // مدیریت تغییر URL تصویر
  // const handleUrlChange = (e) => {
  //   const url = e.target.value.trim();
  //   setImageUrl(url);
  //   setError("");
    
  //   if (!url) {
  //     setPreview(null);
  //     setLocalQuiz({
  //       ...localQuiz,
  //       background_image_url: "",
  //       background_color: localQuiz.background_color || "#ffffff",
  //     });
  //   }
  // };



  const handleUrlChange = (e) => {
  const url = e.target.value.trim();
  setImageUrl(url);
  setError("");
  
  if (!url) {
    setPreview(null);
    setLocalQuiz({
      ...localQuiz,
      background_image_url: "",
      // background_color را تغییر نمی‌دهیم
    });
  }
};













  // مدیریت ارسال URL با دکمه Enter
  const handleUrlKeyPress = (e) => {
    if (e.key === 'Enter') {
      testImageLoad();
    }
  };

  // رنگ‌های پیش‌فرض
  const colorOptions = [
    { name: "White", value: "#ffffff" },
    { name: "Light Blue", value: "#eff6ff" },
    { name: "Light Pink", value: "#fdf2f8" },
    { name: "Light Gray", value: "#f3f4f6" },
    { name: "Beige", value: "#fafaf0" },
    { name: "Mint", value: "#f0fdf4" },
    { name: "Lavender", value: "#f5f3ff" },
    { name: "Custom", value: "custom" },
  ];

  // مدیریت تغییر رنگ
  // const handleColorChange = (color) => {
  //   if (color === "custom") {
  //     const input = document.createElement("input");
  //     input.type = "color";
  //     input.value = localQuiz.background_color || "#ffffff";
  //     input.onchange = (e) => {
  //       setLocalQuiz({
  //         ...localQuiz,
  //         background_color: e.target.value,
  //         background_image_url: "", // وقتی رنگ انتخاب شد، عکس پاک شود
  //       });
  //       setImageUrl("");
  //       setPreview(null);
  //       setError("");
  //     };
  //     input.click();
  //   } else {
  //     setLocalQuiz({
  //       ...localQuiz,
  //       background_color: color,
  //       background_image_url: "", // وقتی رنگ انتخاب شد، عکس پاک شود
  //     });
  //     setImageUrl("");
  //     setPreview(null);
  //     setError("");
  //   }
  // };


  const handleColorChange = (color) => {
  if (color === "custom") {
    const input = document.createElement("input");
    input.type = "color";
    input.value = localQuiz.background_color || "#ffffff";
    input.onchange = (e) => {
      setLocalQuiz({
        ...localQuiz,
        background_color: e.target.value,
        background_image_url: "", // وقتی رنگ انتخاب شد، عکس پاک شود
      });
      setImageUrl("");
      setPreview(null);
      setError("");
    };
    input.click();
  } else {
    setLocalQuiz({
      ...localQuiz,
      background_color: color,
      background_image_url: "", // وقتی رنگ انتخاب شد، عکس پاک شود
    });
    setImageUrl("");
    setPreview(null);
    setError("");
  }
};














  // حذف عکس بک‌گراند
  // const handleRemoveImage = () => {
  //   setLocalQuiz({
  //     ...localQuiz,
  //     background_image_url: "",
  //     background_color: localQuiz.background_color || "#ffffff",
  //   });
  //   setImageUrl("");
  //   setPreview(null);
  //   setError("");
  // };


  const handleRemoveImage = () => {
  setLocalQuiz({
    ...localQuiz,
    background_image_url: "",
    // background_color را تغییر نمی‌دهیم
  });
  setImageUrl("");
  setPreview(null);
  setError("");
};







  // ذخیره تغییرات در سرور
  // const handleSubmit = async () => {
  //   if (!hasChanges) {
  //     onClose();
  //     return;
  //   }

  //   try {
  //     setSaving(true);
      
  //     // داده‌های تغییر یافته را آماده می‌کنیم
  //     const updateData = {
  //       background_color: localQuiz.background_color,
  //       background_image_url: localQuiz.background_image_url
  //     };

  //     // فراخوانی API برای به‌روزرسانی
  //     const updatedQuiz = await quizService.updateQuizBackground(
  //       quiz.quiz_id,
  //       updateData
  //     );
      
  //     console.log("Design changes saved to backend", updatedQuiz);
      
  //     // به‌روزرسانی quiz در parent component
  //     updateQuiz(updatedQuiz);
      
  //     // به‌روزرسانی مقدار اولیه
  //     setOriginalQuiz({ ...localQuiz });
      
  //     setSaving(false);
  //     onClose();
      
  //   } catch (error) {
  //     console.error("Error saving to backend:", error);
  //     setSaving(false);
  //     alert("Failed to save changes. Please try again.");
  //   }
  // };


  const handleSubmit = async () => {
  if (!hasChanges) {
    onClose();
    return;
  }

  try {
    setSaving(true);
    
    // فقط فیلدهایی که تغییر کرده‌اند را می‌فرستیم
    const updateData = {};
    
    if (localQuiz.background_color !== originalQuiz.background_color) {
      updateData.background_color = localQuiz.background_color || "#ffffff";
    }
    
    if (localQuiz.background_image_url !== originalQuiz.background_image_url) {
      updateData.background_image_url = localQuiz.background_image_url;
    }

    // فراخوانی API برای به‌روزرسانی
    const updatedQuiz = await quizService.updateQuizBackground(
      quiz.quiz_id,
      updateData
    );
    
    console.log("Design changes saved to backend", updatedQuiz);
    
    // به‌روزرسانی quiz در parent component
    updateQuiz(updatedQuiz);
    
    // به‌روزرسانی مقدار اولیه
    setOriginalQuiz({ ...localQuiz });
    
    setSaving(false);
    onClose();
    
  } catch (error) {
    console.error("Error saving to backend:", error);
    setSaving(false);
    alert("Failed to save changes. Please try again.");
  }
};










  // لغو تغییرات
  const handleCancel = () => {
    if (hasChanges) {
      const confirmCancel = window.confirm(
        "You have unsaved changes. Are you sure you want to cancel?"
      );
      if (!confirmCancel) return;
    }
    
    // برگرداندن به حالت اولیه
    setLocalQuiz({ ...originalQuiz });
    if (originalQuiz.background_image_url) {
      setImageUrl(originalQuiz.background_image_url);
      setPreview(originalQuiz.background_image_url);
    } else {
      setImageUrl("");
      setPreview(null);
    }
    setError("");
    
    onClose();
  };

  // محاسبه استایل برای نمایش بک‌گراند
  const getBackgroundStyle = () => {
    if (preview) {
      return {
        backgroundImage: `url(${preview})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    } else if (localQuiz.background_color) {
      return {
        backgroundColor: localQuiz.background_color,
      };
    } else if (localQuiz.background_image_url && !preview) {
      // اگر URL ذخیره شده اما preview نداریم
      return {
        backgroundImage: `url(${localQuiz.background_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return {
      backgroundColor: '#ffffff',
    };
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Design</h3>
            {hasChanges && (
              <p className="text-xs text-amber-600 mt-1">
                You have unsaved changes
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* تب‌ها */}
      <div className="flex mb-6">
        <button
          onClick={() => setActiveTab("color")}
          className={`flex-1 py-2 text-sm font-medium rounded-l-lg ${
            activeTab === "color"
              ? "bg-blue-50 text-blue-600 border border-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
          }`}
        >
          Color
        </button>
        <button
          onClick={() => setActiveTab("image")}
          className={`flex-1 py-2 text-sm font-medium rounded-r-lg ${
            activeTab === "image"
              ? "bg-blue-50 text-blue-600 border border-blue-200"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
          }`}
        >
          Image
        </button>
      </div>

      {/* محتوا */}
      {activeTab === "color" ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Background Color :
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  onClick={() => handleColorChange(color.value)}
                  className="flex flex-col items-center"
                >
                  <div
                    className={`w-10 h-10 rounded-lg border mb-1 ${
                      localQuiz.background_color === color.value ||
                      (color.value === "custom" && 
                        !colorOptions.find(c => c.value === localQuiz.background_color))
                        ? "border-pink-500 ring-2 ring-pink-200"
                        : "border-gray-300"
                    }`}
                    style={{
                      backgroundColor: color.value === "custom" 
                        ? "conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)" 
                        : color.value,
                    }}
                  />
                  <span className="text-xs text-gray-600">{color.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Current Color :
            </h3>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={getBackgroundStyle()}
              />
              <div>
                <span className="text-sm font-mono text-gray-700 block">
                  {localQuiz.background_image_url 
                    ? "Image URL" 
                    : localQuiz.background_color || "#ffffff"
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Enter Background Image URL :
            </h3>
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <Link className="w-4 h-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={imageUrl}
                  onChange={handleUrlChange}
                  onKeyPress={handleUrlKeyPress}
                  placeholder="https://example.com/image.jpg"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              
              <button
                onClick={testImageLoad}
                disabled={loading || !imageUrl.trim()}
                className="w-full px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                {loading ? "Checking..." : "Test & Preview Image"}
              </button>
              
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}
              
              
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Preview :
            </h3>
            <div className="relative rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
              <div 
                className="w-full h-40 flex items-center justify-center"
                style={getBackgroundStyle()}
              >
                {!preview && !localQuiz.background_color && !localQuiz.background_image_url && (
                  <div className="text-gray-400 text-sm">
                    No background selected
                  </div>
                )}
                {!preview && localQuiz.background_color && (
                  <div className="text-gray-600 text-sm">
                    Color background
                  </div>
                )}
              </div>
              
              {(localQuiz.background_image_url || localQuiz.background_color) && (
                <div className="absolute top-2 right-2 flex gap-2">
                  {localQuiz.background_image_url && (
                    <button
                      onClick={handleRemoveImage}
                      className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      title="Remove image"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="mt-3 space-y-2">
              {localQuiz.background_image_url && (
                  <button
                    onClick={handleRemoveImage}
                    className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove Image
                  </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasChanges || saving}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
              hasChanges && !saving
                ? "bg-pink-600 text-white hover:bg-pink-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 text-center mt-3">
          {hasChanges 
            ? "Click 'Save Changes' to update quiz background"
            : "No changes to save"
          }
        </p>
      </div>
    </div>
  );
}