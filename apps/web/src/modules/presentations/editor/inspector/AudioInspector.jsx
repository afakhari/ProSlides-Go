import { useState, useRef, useEffect } from "react";
import { X, Music, Trash2, Play, Pause, Save } from "lucide-react";
import { quizService } from "../../api/presentationRepository.ts";
import { ErrorModal } from "../../../../pages/quiz/manager/ErrorModal";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";


export default function AudioPanel({
  onClose,
  quiz,
  updateQuiz,
  setAudioSaveNotice,
  onDirtyChange,
  onConflict,
}) {

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [localAudio, setLocalAudio] = useState(quiz?.music_url || ""); 
  const [hasChanges, setHasChanges] = useState(false);
  const [originalAudio, setOriginalAudio] = useState(quiz?.music_url || ""); 
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
    setOriginalAudio(quiz?.music_url || ""); 
    setLocalAudio(quiz?.music_url || ""); 
  }, [quiz?.music_url]); 


  // Detecting changes from the initial value
  useEffect(() => {
    const hasUnsavedChanges = localAudio !== originalAudio;
    setHasChanges(hasUnsavedChanges);
  }, [localAudio, originalAudio]);

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(hasChanges);
    }
  }, [hasChanges, onDirtyChange]);

  const closeErrorModal = () => {
    setErrorModalOpen(false);
  };

  // Audio link testing and preview
  const testAudioLoad = () => {
    if (!audioUrl.trim()) {
      setError("Please enter the link.");
      return;
    }

    if (!audioUrl.startsWith("http://") && !audioUrl.startsWith("https://")) {
      setError("The link must start with http:// or https://");
      return;
    }

    setLoading(true);
    setError("");

    const audio = new window.Audio();

    audio.oncanplaythrough = () => {
      setLocalAudio(audioUrl);
      setLoading(false);
    };

    audio.onerror = () => {
      setError("Invalid audio link or cannot be loaded.");
      setLoading(false);
    };

    audio.src = audioUrl;

    setTimeout(() => {
      if (audio.readyState === 0) {
        setError("Audio loading took too long. Please try another link.");
        setLoading(false);
      }
    }, 5000);
  };


  // Test and preview the inserted link by pressing the Enter key
  const handleUrlKeyPress = (e) => {
    if (e.key === 'Enter') {
      testAudioLoad();
    }
  };


  /*  
    Temporarily remove sound from the front end only; To completely remove sound from the back and front, 
    the "Save Changes" button must be pressed to execute the "handleSubmit".
  */
  const handleRemoveAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }

    setLocalAudio("");
    setAudioUrl("");
  };


  // Manage audio playback and pausing
  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };


  // Automatically replay audio after it ends
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };


  // Save sound changes in front end and back end
  const handleSubmit = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    if (!quiz?.quiz_id) {
      setErrorForModal("Quiz ID is required.");
      setErrorModalOpen(true);
      return;
    }

    setSaving(true);

    try {
      // Send a request to the back end to update the music
      const updatedQuiz = await quizService.updateQuizMusic(quiz.quiz_id, localAudio, quiz.revision);
      
      // Updating the quiz in the parent component(EditorPage)
      if (updateQuiz) {
        updateQuiz(updatedQuiz);
      }
      
      setOriginalAudio(localAudio);
      setSaving(false);
      onClose();

      if (setAudioSaveNotice) {
        setAudioSaveNotice("Audio changed successfully.");
        setTimeout(() => {
          setAudioSaveNotice(null);
        }, 2500);
      }

      setHasChanges(false);
      if (onDirtyChange) {
        onDirtyChange(false);
      }
      
    } catch (saveError) {
      if (saveError.response?.status === 409 && saveError.response?.data?.error === "edit_conflict") {
        if (onConflict) await onConflict();
        setErrorForModal("This presentation changed elsewhere. The latest version has been loaded.");
      } else {
        setErrorForModal("Failed to save changes. Please try again.");
      }
      setErrorModalOpen(true);
      setSaving(false);
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
          resetAudioToOriginal();
        },
        confirmText: "Discard Changes",
        cancelText: "Keep Editing",
      });
      return;
    }

    resetAudioToOriginal();
  };

  const resetAudioToOriginal = () => {
    setLocalAudio(originalAudio);
    setAudioUrl("");
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


  return (
    <>
      {/* --------------- Header --------------- */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Audio</h3>
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


      {/* --------------- Content --------------- */}
      <div className="space-y-6">
        {/* --------------- Upload Section --------------- */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Enter Audio URL :</h4>

          <div className="space-y-3">
            <input
              type="text"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              onKeyPress={handleUrlKeyPress}
              placeholder="https://example.com/audio.mp3"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition"
            />
            
            <button
              onClick={testAudioLoad}
              disabled={loading || !audioUrl.trim()}
              className="w-full px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              {loading ? "Checking..." : "Test & Preview Audio"}
            </button>

            {error && (
              <p className="text-red-600 text-sm mt-2">{error}</p>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h5 className="font-medium text-amber-800 text-sm mb-1">?? Recommendation</h5>
            <p className="text-amber-700 text-xs">
              Use short audio clips (under 30 seconds) for better experience. Audio will loop automatically.
            </p>
          </div>
        </div>


        {/* --------------- Current Audio Section --------------- */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Current Audio :</h4>
          {localAudio ? (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <Music className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">
                    {localAudio.split("/").pop().substring(0, 30) || "Audio link"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {hasChanges ? "Unsaved changes" : "Saved"}
                  </p>
                </div>
              </div>

              {/* --------------- Audio Player --------------- */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePlayPause}
                    className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-1/3"></div>
                    </div>
                  </div>
                </div>

                {/* --------------- Hidden Audio Element For Automatic Audio Playback  --------------- */}
                <audio
                  ref={audioRef}
                  src={localAudio}
                  onEnded={handleAudioEnded}
                />

                <button
                  onClick={handleRemoveAudio}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Audio
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
              <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm mb-2">No audio selected</p>
              <p className="text-gray-500 text-xs">Upload a background music for this quiz</p>
            </div>
          )}
        </div>


        {/* --------------- Save And Cancel Buttons --------------- */}
        <div className="pt-6 border-t border-gray-100">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={!hasChanges || saving}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
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
              ? "Click 'Save Changes' to store music URL"
              : "No changes to save"
            }
          </p>
        </div>
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
    </>
  );
}
