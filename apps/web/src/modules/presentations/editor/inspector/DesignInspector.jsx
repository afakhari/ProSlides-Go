import React, { useState, useEffect } from "react";
import { X, Trash2, Save, Link } from "lucide-react";
import { quizService } from "../../api/presentationRepository.ts";
import { ErrorModal } from "../../../../pages/quiz/manager/ErrorModal";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";


export default function DesignPanel({
  quiz,
  updateQuiz,
  onClose,
  setBackgroundSaveNotice,
  onDirtyChange,
  onConflict,
}) {

  const [activeTab, setActiveTab] = useState("color");
  const [localQuiz, setLocalQuiz] = useState({ ...quiz });
  const [hasChanges, setHasChanges] = useState(false);
  const [originalQuiz, setOriginalQuiz] = useState({ ...quiz });
  const [imageUrl, setImageUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorForModal, setErrorForModal] = useState(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: null,
    confirmText: "",
    cancelText: "",
  });


  // Setting the initial value when loading the component
  useEffect(() => {
    const normalizedQuiz = {
      ...quiz,
      text_color: quiz.text_color || "#111827",
    };
    setOriginalQuiz({ ...normalizedQuiz });
    setLocalQuiz({ ...normalizedQuiz });
    
    if (quiz.background_image_url) {
      setImageUrl(quiz.background_image_url);
      setPreview(quiz.background_image_url);
    }
  }, [quiz]);


  // Detecting changes from the initial value
  useEffect(() => {
    const hasBgColorChanged = localQuiz.background_color !== originalQuiz.background_color;
    const hasBgImageChanged = localQuiz.background_image_url !== originalQuiz.background_image_url;
    const hasTextColorChanged = localQuiz.text_color !== originalQuiz.text_color;
    
    setHasChanges(hasBgColorChanged || hasBgImageChanged || hasTextColorChanged);
  }, [localQuiz, originalQuiz]);

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(hasChanges);
    }
  }, [hasChanges, onDirtyChange]);

  const closeErrorModal = () => {
    setErrorModalOpen(false);
  };

  // Image link testing and preview
  const testImageLoad = () => {
    if (!imageUrl.trim()) {
      setError("Please enter the link.");
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
      });
      setLoading(false);
    };
    
    img.onerror = () => {
      setError("Invalid image link or cannot be loaded.");
      setPreview(null);
      setLocalQuiz({
        ...localQuiz,
        background_image_url: "",
        background_color: localQuiz.background_color || "#ffffff",
      });
      setLoading(false);
    };
    
    img.src = imageUrl;

    setTimeout(() => {
      if (!img.complete) {
        setError("Image loading took too long. Please try another link.");
        setLoading(false);
      }
    }, 5000);
  };


  // Detecting changes from the initial value
  const handleUrlChange = (e) => {
    const url = e.target.value.trim();
    setImageUrl(url);
    setError("");
    
    if (!url) {
      setPreview(null);
      setLocalQuiz({
        ...localQuiz,
        background_image_url: "",
      });
    }
  };


  // Test and preview the inserted link by pressing the Enter key
  const handleUrlKeyPress = (e) => {
    if (e.key === 'Enter') {
      testImageLoad();
    }
  };


  // Default colors
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

  
  // Set the selected color locally
  const handleColorChange = (color) => {
    if (color === "custom") {
      const input = document.createElement("input");
      input.type = "color";
      input.value = localQuiz.background_color || "#ffffff";
      input.onchange = (e) => {
        setLocalQuiz({
          ...localQuiz,
          background_color: e.target.value,
          background_image_url: "", 
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
        background_image_url: "",
      });
      setImageUrl("");
      setPreview(null);
      setError("");
    }
  };

  const handleTextColorChange = (color) => {
    setLocalQuiz({
      ...localQuiz,
      text_color: color,
    });
  };


  /*  
    Temporarily remove image from the front end only; To completely remove image from the back and front, 
    the "Save Changes" button must be pressed to execute the "handleSubmit".
  */
  const handleRemoveImage = () => {
    setLocalQuiz({
      ...localQuiz,
      background_image_url: "",
    });
    setImageUrl("");
    setPreview(null);
    setError("");
  };


  // Save image changes in front end and back end
  const handleSubmit = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      
      const updateData = {};
      
      if (localQuiz.background_color !== originalQuiz.background_color) {
        updateData.background_color = localQuiz.background_color || "#ffffff";
      }
      
      if (localQuiz.background_image_url !== originalQuiz.background_image_url) {
        updateData.background_image_url = localQuiz.background_image_url;
      }

      if (localQuiz.text_color !== originalQuiz.text_color) {
        updateData.text_color = localQuiz.text_color || "#111827";
      }

      // Send a request to the back end to update the background
      const updatedQuiz = await quizService.updateQuizBackground(
        quiz.quiz_id,
        updateData,
        quiz.revision
      );
      
      // Updating the quiz in the parent component(EditorPage)
      const mergedQuiz = updatedQuiz;
      updateQuiz(updatedQuiz);
      
      setOriginalQuiz({ ...mergedQuiz });
      
      setSaving(false);
      onClose();

      if (setBackgroundSaveNotice) {
        setBackgroundSaveNotice("Quiz background changed successfully.");
        setTimeout(() => {
          setBackgroundSaveNotice(null);
        }, 2500);
      }

      setHasChanges(false);
      if (onDirtyChange) {
        onDirtyChange(false);
      }
      
    } catch (saveError) {
      setSaving(false);
      if (saveError.response?.status === 409 && saveError.response?.data?.error === "edit_conflict") {
        if (onConflict) await onConflict();
        setErrorForModal("This presentation changed elsewhere. The latest version has been loaded.");
      } else {
        setErrorForModal("Failed to save changes. Please try again.");
      }
      setErrorModalOpen(true);
    }
  };


  // Cancel changes
  const handleCancel = () => {
    if (hasChanges) {
      setConfirmDialog({
        isOpen: true,
        title: "Unsaved Changes",
        description: "You have unsaved changes. Are you sure you want to cancel?",
        onConfirm: () => {
          resetToOriginal();
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }
    
    resetToOriginal();
  };

  const resetToOriginal = () => {
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

  const handleConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    closeConfirmDialog();
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      isOpen: false,
      title: "",
      description: "",
      onConfirm: null,
      confirmText: "",
      cancelText: "",
    });
  };

  const handleCancelForModal = () => {
    closeConfirmDialog();
  };


  // Calculating the style for displaying the background
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
      {/* --------------- Header --------------- */}
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


      {/* --------------- Color And Image Tabs --------------- */}
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


      {/* --------------- Content --------------- */}
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Text Color :
            </h3>
            <div className="flex items-center gap-3">
              {[
                { label: "Black", value: "#111827" },
                { label: "White", value: "#ffffff" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleTextColorChange(opt.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    localQuiz.text_color === opt.value
                      ? "border-pink-500 ring-2 ring-pink-200"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-gray-300"
                    style={{ backgroundColor: opt.value }}
                  />
                  <span className="text-gray-700">{opt.label}</span>
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
              <div className="w-8 h-8 rounded border border-gray-300 bg-white flex items-center justify-center">
                <span
                  className="text-xs font-semibold"
                  style={{ color: localQuiz.text_color || "#111827" }}
                >
                  Aa
                </span>
              </div>
              <div>
                <span className="text-sm font-mono text-gray-700 block">
                  {localQuiz.background_image_url 
                    ? "Image URL" 
                    : localQuiz.background_color || "#ffffff"
                  }
                </span>
                <span className="text-xs text-gray-500 block">
                  Text: {localQuiz.text_color || "#111827"}
                </span>
                <span
                  className="mt-1 inline-block text-xs"
                  style={{ color: localQuiz.text_color || "#111827" }}
                >
                  Sample text preview
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

          
          {/* --------------- Preview Section --------------- */}
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


      {/* --------------- Save And Cancel Buttons --------------- */}
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

      <ErrorModal
        isOpen={errorModalOpen}
        onClose={closeErrorModal}
        message={errorForModal}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCancelForModal}
        onConfirm={handleConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmVariant="destructive"
        isLoading={false}
      />
    </div>
  );
}
