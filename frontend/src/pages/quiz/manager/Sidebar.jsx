import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useCallback, useEffect, useState } from "react";
import {
  GripVertical,
  Trash2,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  X,
  Plus,
  Save,
  Loader2
} from "lucide-react";

import { quizService } from "../../../services/quizService"; 


export default function Sidebar({ 
  quizId,
  slide, 
  setSlide, 
  activeSlideType,
  onClose,
  onSlideUpdated
}) {
  // StateÙ‡Ø§ÛŒ Ù…Ø¯ÛŒØ±ÛŒØª ØªØºÛŒÛŒØ±Ø§Øª
  const [localSlide, setLocalSlide] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSlide, setOriginalSlide] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [originalOptions, setOriginalOptions] = useState([]);
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: "",
    id: null,
  });

  // ØªÙ†Ø¸ÛŒÙ… Ù…Ù‚Ø§Ø¯ÛŒØ± Ø§ÙˆÙ„ÛŒÙ‡ Ù‡Ù†Ú¯Ø§Ù… Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ
  useEffect(() => {
    if (slide) {
      // Ø³Ø§Ø®Øª Ø¯Ø§Ø¯Ù‡ Ù…Ø­Ù„ÛŒ Ø§Ø² slide
      const slideData = {
        ...slide,
        question: slide.question ? {
          ...slide.question,
          // Ù†Ú¯Ø§Ø´Øª ÙÛŒÙ„Ø¯Ù‡Ø§ Ø¨Ù‡ Ù†Ø§Ù…â€ŒÙ‡Ø§ÛŒ Ù…ÙˆØ±Ø¯ Ø§Ø³ØªÙØ§Ø¯Ù‡ Ø¯Ø± Ú©Ø§Ù…Ù¾ÙˆÙ†Ù†Øª
          question_text: slide.question.text || "",
          question_image: slide.question.image_url || "",
          question_type: slide.question.question_type || "single",
          question_time: slide.question.time_limit || 10,
          max_point: slide.question.max_point || 0,
          min_point: slide.question.min_point || 0,
          faster_answers_more_points: slide.question.faster_answers_more_points || false,
          partial_scoring: slide.question.partial_scoring || false,
          options: slide.question.options || []
        } : null
      };
      
      setOriginalSlide(slideData);
      setLocalSlide(slideData);
      setOriginalOptions(slide.question?.options || []);
    }
  }, [slide]);

  // Ø¬Ø§Ø¨Ù‡â€ŒØ¬Ø§ÛŒÛŒ Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§ (ÙÙ‚Ø· Ø¯Ø± ÙØ±Ø§Ù†Øª)
  const onDragEnd = useCallback(
    (result) => {
      if (!result.destination || !localSlide || !localSlide.question) return;
      
      const options = localSlide.question.options || [];
      const newOptions = Array.from(options);
      const [moved] = newOptions.splice(result.source.index, 1);
      newOptions.splice(result.destination.index, 0, moved);
      
      setLocalSlide({ 
        ...localSlide,
        question: {
          ...localSlide.question,
          options: newOptions
        }
      });
    },
    [localSlide]
  );

  // ØªØ´Ø®ÛŒØµ ØªØºÛŒÛŒØ±Ø§Øª
  useEffect(() => {
    if (!localSlide || !originalSlide) return;

    const hasChanged = () => {
      // Ù…Ù‚Ø§ÛŒØ³Ù‡ ÙÛŒÙ„Ø¯Ù‡Ø§ÛŒ Ø§ØµÙ„ÛŒ slide
      const slideFields = ['show_leaderboard_after'];
      
      for (const field of slideFields) {
        if (localSlide[field] !== originalSlide[field]) {
          return true;
        }
      }

      // Ù…Ù‚Ø§ÛŒØ³Ù‡ ÙÛŒÙ„Ø¯Ù‡Ø§ÛŒ question
      if (localSlide.question && originalSlide.question) {
        const questionFields = [
          'question_text',
          'question_image',
          'question_type',
          'question_time',
          'max_point',
          'min_point',
          'faster_answers_more_points',
          'partial_scoring'
        ];

        for (const field of questionFields) {
          if (localSlide.question[field] !== originalSlide.question[field]) {
            return true;
          }
        }

        // Ù…Ù‚Ø§ÛŒØ³Ù‡ options
        const currentOptions = localSlide.question.options || [];
        const originalOpts = originalOptions;

        if (currentOptions.length !== originalOpts.length) {
          return true;
        }

        for (let i = 0; i < currentOptions.length; i++) {
          const current = currentOptions[i];
          const original = originalOpts[i];
          
          if (!original || 
              current.text !== original.text ||
              current.is_correct !== original.is_correct ||
              current.image_url !== original.image_url) {
            return true;
          }
        }
      }

      return false;
    };

    setHasChanges(hasChanged());
  }, [localSlide, originalSlide, originalOptions]);

  // Effect Ø¨Ø±Ø§ÛŒ Ø§Ø·Ù…ÛŒÙ†Ø§Ù† Ø§Ø² Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ© Ú¯Ø²ÛŒÙ†Ù‡ ØµØ­ÛŒØ­ Ø¯Ø± Ø³ÙˆØ§Ù„Ø§Øª multiple
  useEffect(() => {
    if (!localSlide || !localSlide.question) return;
    
    const questionType = localSlide.question.question_type;
    const options = localSlide.question.options || [];
    
    if (questionType === "multiple" && options.length > 0) {
      const hasCorrectAnswer = options.some(opt => opt.is_correct);
      if (!hasCorrectAnswer) {
        const updatedOptions = options.map((opt, index) => 
          index === 0 ? { ...opt, is_correct: true } : opt
        );
        
        setLocalSlide({
          ...localSlide,
          question: {
            ...localSlide.question,
            options: updatedOptions
          }
        });
      }
    }
  }, [localSlide?.question?.question_type, localSlide?.question?.options?.length, localSlide]);

  // Ø§Ú¯Ø± slide ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯ØŒ Ú©Ø§Ù…Ù¾ÙˆÙ†Ù†Øª Ø±Ø§ Ø±Ù†Ø¯Ø± Ù†Ú©Ù†
  if (!slide || !localSlide) {
    return <div className="h-full overflow-y-auto p-4">No Slide Selected</div>;
  }

  const safeSlide = localSlide;
  const question = safeSlide.question;
  const options = question?.options || [];
  const questionType = question?.question_type || "";

  // ØªØºÛŒÛŒØ± Ù…ØªÙ† Ø³ÙˆØ§Ù„
  const handleQuestionChange = (value) => {
    setLocalSlide({
      ...safeSlide,
      question: {
        ...question,
        question_text: value
      }
    });
  };

  // Ø§Ø¶Ø§ÙÙ‡ Ú©Ø±Ø¯Ù† Ú¯Ø²ÛŒÙ†Ù‡ Ø¬Ø¯ÛŒØ¯
  const handleAddOption = async () => {
    const newId = options.length > 0
      ? Math.max(...options.map(o => o.option_id || 0)) + 1
      : 1;

    const newOption = {
      option_id: newId,
      text: `Option ${newId}`,
      is_correct: options.length === 0 && questionType === "multiple",
      image_url: "",
      votes: 0
    };

    setLocalSlide({
      ...safeSlide,
      question: {
        ...question,
        options: [...options, newOption]
      }
    });
  };

  // Ø­Ø°Ù Ú¯Ø²ÛŒÙ†Ù‡
  const handleDeleteOption = async (id) => {
    if (!quizId || !slide.slide_id) return;

    const remainingOptions = options.filter((opt) => opt.option_id !== id);
    const hasCorrectAnswer = remainingOptions.some(opt => opt.is_correct);
    
    // Ø§Ú¯Ø± Ù‡ÛŒÚ† Ú¯Ø²ÛŒÙ†Ù‡ ØµØ­ÛŒØ­ÛŒ Ø¨Ø§Ù‚ÛŒ Ù†Ù…Ø§Ù†Ø¯Ù‡ Ùˆ Ø³ÙˆØ§Ù„ multiple Ø§Ø³ØªØŒ Ø§ÙˆÙ„ÛŒÙ† Ú¯Ø²ÛŒÙ†Ù‡ Ø±Ø§ ØµØ­ÛŒØ­ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ…
    let updatedOptions = remainingOptions;
    if (!hasCorrectAnswer && questionType === "multiple" && remainingOptions.length > 0) {
      updatedOptions = remainingOptions.map((opt, index) => 
        index === 0 ? { ...opt, is_correct: true } : opt
      );
    }
    
    setLocalSlide({
      ...safeSlide,
      question: {
        ...question,
        options: updatedOptions
      }
    });
  };

  // ØªØºÛŒÛŒØ± Ù…Ù‚Ø¯Ø§Ø± Ú¯Ø²ÛŒÙ†Ù‡
  const handleOptionChange = (id, field, value) => {
    setLocalSlide({
      ...safeSlide,
      question: {
        ...question,
        options: options.map((opt) =>
          opt.option_id === id ? { ...opt, [field]: value } : opt
        )
      }
    });
  };

  // Ø§Ù†ØªØ®Ø§Ø¨ Ú¯Ø²ÛŒÙ†Ù‡ Ø¯Ø±Ø³Øª
  const handleSelectCorrect = (id) => {
    if (questionType === "single") {
      // Ø¨Ø±Ø§ÛŒ Single Choice: ÙÙ‚Ø· ÛŒÚ© Ú¯Ø²ÛŒÙ†Ù‡ Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ Ø¯Ø±Ø³Øª Ø¨Ø§Ø´Ø¯
      setLocalSlide({
        ...safeSlide,
        question: {
          ...question,
          options: options.map((opt) => ({
            ...opt,
            is_correct: opt.option_id === id
          }))
        }
      });
    } else if (questionType === "multiple") {
      // Ø¨Ø±Ø§ÛŒ Multiple Choice: Ù…ÛŒâ€ŒØªÙˆØ§Ù† Ú†Ù†Ø¯ Ú¯Ø²ÛŒÙ†Ù‡ Ø±Ø§ Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ø±Ø¯
      const clickedOption = options.find(opt => opt.option_id === id);
      const isCurrentlyCorrect = clickedOption?.is_correct;
      const correctOptionsCount = options.filter(opt => opt.is_correct).length;
      
      // Ø§Ú¯Ø± Ú©Ø§Ø±Ø¨Ø± Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡Ø¯ Ø¢Ø®Ø±ÛŒÙ† Ú¯Ø²ÛŒÙ†Ù‡ ØµØ­ÛŒØ­ Ø±Ø§ ØºÛŒØ±ÙØ¹Ø§Ù„ Ú©Ù†Ø¯ØŒ Ø§Ø¬Ø§Ø²Ù‡ Ù†Ù…ÛŒâ€ŒØ¯Ù‡ÛŒÙ…
      if (isCurrentlyCorrect && correctOptionsCount === 1) {
        return;
      }
      
      setLocalSlide({
        ...safeSlide,
        question: {
          ...question,
          options: options.map((opt) =>
            opt.option_id === id ? { ...opt, is_correct: !opt.is_correct } : opt
          )
        }
      });
    }
  };

  // ØªØ§Ø¨Ø¹ Ø¨Ø±Ø§ÛŒ handle Ù„ÛŒÙ†Ú© ØªØµÙˆÛŒØ±
  const handleImageLink = (link, type, id = null) => {
    if (type === "question") {
      setLocalSlide({
        ...safeSlide,
        question: {
          ...question,
          question_image: link
        }
      });
    } else if (type === "option") {
      handleOptionChange(id, "image_url", link);
    }
  };

  // Ø¨Ø§Ø² Ú©Ø±Ø¯Ù† Modal
  const openImageLinkModal = (type, id = null) => {
    setModalState({
      isOpen: true,
      type,
      id,
    });
  };

  // Ø¨Ø³ØªÙ† Modal
  const closeImageLinkModal = () => {
    setModalState({
      isOpen: false,
      type: "",
      id: null,
    });
  };

  // Ø­Ø°Ù ØªØµÙˆÛŒØ±
  const handleRemoveImage = (type, id = null) => {
    if (type === "question") {
      setLocalSlide({
        ...safeSlide,
        question: {
          ...question,
          question_image: ""
        }
      });
    } else if (type === "option") {
      handleOptionChange(id, "image_url", "");
    }
  };

  // Ø¨Ø±Ø±Ø³ÛŒ ÙˆØ¬ÙˆØ¯ Ø§Ø³Ù„Ø§ÛŒØ¯ Ù„ÛŒØ¯Ø±Ø¨Ø±Ø¯ Ù…Ø±ØªØ¨Ø·
  // Ù…Ø¯ÛŒØ±ÛŒØª ØªØºÛŒÛŒØ±Ø§Øª ÙÛŒÙ„Ø¯Ù‡Ø§
  const handleFieldChange = (field, value) => {
    setLocalSlide({
      ...safeSlide,
      question: {
        ...question,
        [field]: value
      }
    });
  };

  // Ù…Ø¯ÛŒØ±ÛŒØª ØªØºÛŒÛŒØ±Ø§Øª slide fields
  const handleSlideFieldChange = (field, value) => {
    setLocalSlide({
      ...safeSlide,
      [field]: value
    });
  };

  // Ø°Ø®ÛŒØ±Ù‡ ØªØºÛŒÛŒØ±Ø§Øª Ø¨Ù‡ Ø¨Ú©â€ŒØ§Ù†Ø¯
  const handleSubmit = async () => {
    if (!hasChanges || !slide || !quizId || isSaving) return;

    setIsSaving(true);
    try {
      // 1. Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø³ÙˆØ§Ù„
      if (safeSlide.question) {
        const questionData = {
          title: "", // Ù‡Ù…ÛŒØ´Ù‡ Ø®Ø§Ù„ÛŒ
          text: safeSlide.question.question_text || "",
          question_type: safeSlide.question.question_type,
          min_point: safeSlide.question.min_point || 0,
          max_point: safeSlide.question.max_point || 0,
          time_limit: safeSlide.question.question_time || 10,
          image_url: safeSlide.question.question_image || "",
          faster_answers_more_points: safeSlide.question.faster_answers_more_points || false,
          partial_scoring: safeSlide.question.partial_scoring || false
        };

        let updatedQuestion;
        if (originalSlide.question) {
          // Ø³ÙˆØ§Ù„ Ø§Ø² Ù‚Ø¨Ù„ ÙˆØ¬ÙˆØ¯ Ø¯Ø§Ø±Ø¯ - update
          updatedQuestion = await quizService.updateQuestion(
            quizId,
            slide.slide_id,
            questionData
          );
        } else {
          // Ø³ÙˆØ§Ù„ Ø¬Ø¯ÛŒØ¯ - create
          updatedQuestion = await quizService.createQuestion(
            quizId,
            slide.slide_id,
            questionData
          );
        }

        // 2. Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§
        const currentOptions = safeSlide.question.options || [];
        
        // Ø­Ø°Ù Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§ÛŒÛŒ Ú©Ù‡ Ø¯Ø± original Ø¨ÙˆØ¯Ù†Ø¯ Ø§Ù…Ø§ Ø¯Ø± current Ù†ÛŒØ³ØªÙ†Ø¯
        for (const originalOption of originalOptions) {
          if (!currentOptions.find(opt => opt.option_id === originalOption.option_id)) {
            await quizService.deleteOption(
              quizId,
              slide.slide_id,
              originalOption.option_id
            );
          }
        }

        // Ø§ÛŒØ¬Ø§Ø¯ ÛŒØ§ Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ú¯Ø²ÛŒÙ†Ù‡â€ŒÙ‡Ø§
        for (const option of currentOptions) {
          const optionData = {
            text: option.text,
            is_correct: option.is_correct,
            image_url: option.image_url || ""
          };

          // Ø§Ú¯Ø± Ú¯Ø²ÛŒÙ†Ù‡ Ø¯Ø± original ÙˆØ¬ÙˆØ¯ Ø¯Ø§Ø´ØªØŒ update Ú©Ù†
          const originalOption = originalOptions.find(opt => opt.option_id === option.option_id);
          if (originalOption) {
            await quizService.updateOption(
              quizId,
              slide.slide_id,
              option.option_id,
              optionData
            );
          } else {
            // Ú¯Ø²ÛŒÙ†Ù‡ Ø¬Ø¯ÛŒØ¯
            await quizService.createOption(
              quizId,
              slide.slide_id,
              optionData
            );
          }
        }

        // 3. Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ show_leaderboard_after Ø¯Ø± Ø§Ø³Ù„Ø§ÛŒØ¯
        await quizService.updateSlide(quizId, slide.slide_id, {
          show_leaderboard_after: safeSlide.show_leaderboard_after || false,
          slide_type: 1
        });

        // Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ state Ø§ØµÙ„ÛŒ
        const updatedSlide = {
          ...slide,
          show_leaderboard_after: safeSlide.show_leaderboard_after,
          question: {
            ...updatedQuestion,
            options: currentOptions
          }
        };

        setSlide(updatedSlide);
        setOriginalSlide(safeSlide);
        setOriginalOptions([...currentOptions]);

        // Ø§Ø·Ù„Ø§Ø¹ Ø¨Ù‡ parent component
        if (onSlideUpdated) {
          onSlideUpdated(updatedSlide);
        }

        console.log("Changes saved successfully");
      }

      // Ø¨Ø³ØªÙ† Ù¾Ù†Ù„
      onClose();
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Ù„ØºÙˆ ØªØºÛŒÛŒØ±Ø§Øª
  const handleCancel = () => {
    if (hasChanges) {
      const confirmCancel = window.confirm(
        "You have unsaved changes. Are you sure you want to cancel?"
      );
      if (!confirmCancel) return;
    }
    
    // Ø¨Ø±Ú¯Ø±Ø¯Ø§Ù†Ø¯Ù† Ø¨Ù‡ Ø­Ø§Ù„Øª Ø§ÙˆÙ„ÛŒÙ‡
    setLocalSlide(originalSlide);
    onClose();
  };

  // Modal Ø¨Ø±Ø§ÛŒ ÙˆØ±ÙˆØ¯ Ù„ÛŒÙ†Ú© ØªØµÙˆÛŒØ±
  const ImageLinkModal = ({ isOpen, onClose, onConfirm, type, id = null }) => {
    const [link, setLink] = useState("");
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handlePreview = async () => {
      if (!link.trim()) {
        setError("Ù„Ø·ÙØ§ Ù„ÛŒÙ†Ú© Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯");
        return;
      }

      if (!link.startsWith("http://") && !link.startsWith("https://")) {
        setError("The link must start with http:// or https://");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const img = new Image();
        img.onload = () => {
          setPreview(link);
          setLoading(false);
        };
        img.onerror = () => {
          setError("Ù„ÛŒÙ†Ú© ØªØµÙˆÛŒØ± Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª ÛŒØ§ Ù‚Ø§Ø¨Ù„ Ø¨Ø§Ø±Ú¯ÛŒØ±ÛŒ Ù†ÛŒØ³Øª");
          setPreview(null);
          setLoading(false);
        };
        img.src = link;

        setTimeout(() => {
          if (!img.complete) {
            setError("Ø¨Ø§Ø±Ú¯ÛŒØ±ÛŒ ØªØµÙˆÛŒØ± Ø²Ù…Ø§Ù†â€ŒØ¨Ø± Ø´Ø¯. Ù„Ø·ÙØ§ Ù„ÛŒÙ†Ú© Ø¯ÛŒÚ¯Ø±ÛŒ Ø±Ø§ Ø§Ù…ØªØ­Ø§Ù† Ú©Ù†ÛŒØ¯");
            setLoading(false);
          }
        }, 5000);
      } catch {
        setError("Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø±Ø±Ø³ÛŒ Ù„ÛŒÙ†Ú©");
        setLoading(false);
      }
    };

    const handleSubmit = () => {
      if (preview) {
        onConfirm(link, type, id);
        setLink("");
        setPreview(null);
        onClose();
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]">
        <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Please enter the image link
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL:
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    setError("");
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <button
                  onClick={handlePreview}
                  disabled={loading || !link.trim()}
                  className="px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? "Under Review ..." : "Preview"}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            {preview && (
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                <div className="relative">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-48 object-contain rounded-lg bg-gray-50"
                    onError={() => setError("Ø®Ø·Ø§ Ø¯Ø± Ù†Ù…Ø§ÛŒØ´ ØªØµÙˆÛŒØ±")}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!preview}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Ù‡Ø¯Ø± */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Slide Settings</h3>
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
          disabled={isSaving}
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Question Slides Content */}
      {safeSlide.slide_type === 1 && question && (
        <div className="space-y-6">
          {/* Question Text */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Question Text:</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={question.question_text || ""}
                onChange={(e) => handleQuestionChange(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-center"
                placeholder="Enter your question here..."
                disabled={isSaving}
              />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openImageLinkModal("question")}
                  className="p-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200 flex items-center justify-center"
                  title="Ø§ÙØ²ÙˆØ¯Ù† Ù„ÛŒÙ†Ú© ØªØµÙˆÛŒØ±"
                  disabled={isSaving}
                >
                  <ImageIcon className="w-4 h-4 text-gray-600" />
                </button>
                
                {question.question_image && (
                  <div className="relative group">
                    <img
                      src={question.question_image}
                      alt="Question"
                      className="w-10 h-10 object-cover rounded-md border border-gray-300"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-md transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleRemoveImage("question")}
                        className="bg-white rounded-full p-1 text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                        disabled={isSaving}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">Options:</h3>
              {questionType && (
                <div className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                  {questionType === "single"
                    ? "Single Choice"
                    : "Multiple Choice"}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 mb-3">
              {questionType === "single"
                ? "Select only one correct option"
                : "Select one or more correct options"}
            </p>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="options">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    {options.map((opt, index) => (
                      <Draggable
                        key={opt.option_id}
                        draggableId={opt.option_id.toString()}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className="flex items-start gap-2 mb-2 border border-gray-200 rounded-lg p-2 bg-white hover:border-gray-300 transition-colors"
                          >
                            {/* Drag */}
                            <div
                              {...provided.dragHandleProps}
                              className="p-2 bg-gray-100 rounded-lg cursor-grab hover:bg-gray-200 transition-colors border border-gray-200"
                              title="Drag to reorder"
                            >
                              <GripVertical className="w-4 h-4 text-gray-600" />
                            </div>

                            {/* Correct */}
                            <button
                              onClick={() => handleSelectCorrect(opt.option_id)}
                              className={`p-2 rounded-lg border transition-colors ${
                                opt.is_correct
                                  ? "bg-green-100 border-green-200 text-green-600 hover:bg-green-200"
                                  : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
                              }`}
                              title="Mark as correct"
                              disabled={isSaving}
                            >
                              {opt.is_correct ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>

                            {/* Text & Image */}
                            <div className="flex-1 flex flex-col gap-1">
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) =>
                                  handleOptionChange(
                                    opt.option_id,
                                    "text",
                                    e.target.value
                                  )
                                }
                                className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent text-center"
                                placeholder="Option text..."
                                disabled={isSaving}
                              />

                              {opt.image_url && (
                                <div className="relative mt-1 w-fit group">
                                  <img
                                    src={opt.image_url}
                                    alt="Option"
                                    className="w-16 h-16 object-cover rounded-lg border border-gray-300"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <button
                                      onClick={() =>
                                        handleRemoveImage("option", opt.option_id)
                                      }
                                      className="bg-white rounded-full p-1 text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                                      disabled={isSaving}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Upload image */}
                            <button
                              onClick={() => openImageLinkModal("option", opt.option_id)}
                              className="p-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors border border-gray-200"
                              title="Ø§ÙØ²ÙˆØ¯Ù† Ù„ÛŒÙ†Ú© ØªØµÙˆÛŒØ±"
                              disabled={isSaving}
                            >
                              <ImageIcon className="w-4 h-4 text-gray-600" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteOption(opt.option_id)}
                              className="p-2 bg-gray-100 rounded-lg hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors border border-gray-200"
                              title="Delete option"
                              disabled={isSaving}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <button
              onClick={handleAddOption}
              disabled={isSaving}
              className="
                flex items-center justify-center gap-2
                mb-2 border border-gray-300 border-dashed rounded-lg p-2
                bg-white w-full
                cursor-pointer
                hover:bg-blue-50 hover:border-blue-300
                transition-colors
                text-gray-700 hover:text-blue-600
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Option</span>
            </button>
          </div>

          {/* Modal */}
          <ImageLinkModal
            isOpen={modalState.isOpen}
            onClose={closeImageLinkModal}
            onConfirm={handleImageLink}
            type={modalState.type}
            id={modalState.id}
          />

          {/* Question Time */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Question Time:</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                value={question.question_time || 10}
                onChange={(e) =>
                  handleFieldChange("question_time", parseInt(e.target.value) || 10)
                }
                className="w-20 border border-gray-300 rounded-lg p-2 text-center focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                disabled={isSaving}
              />
              <div>
                <span className="text-sm font-medium text-gray-700">seconds</span>
                <p className="text-xs text-gray-500 mt-1">Time given to answer this question</p>
              </div>
            </div>
          </div>

          {/* Points */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Scoring:</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Points</label>
                <input
                  type="number"
                  min="0"
                  value={question.max_point || 0}
                  onChange={(e) =>
                    handleFieldChange("max_point", parseInt(e.target.value) || 0)
                  }
                  className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  disabled={isSaving}
                />
                <p className="text-xs text-gray-500 mt-1">Points for answering at the start</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min Points</label>
                <input
                  type="number"
                  min="0"
                  value={question.min_point || 0}
                  onChange={(e) =>
                    handleFieldChange("min_point", parseInt(e.target.value) || 0)
                  }
                  className={`w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${
                    !question.faster_answers_more_points ? "bg-gray-100 cursor-not-allowed opacity-50" : ""
                  }`}
                  disabled={isSaving || !question.faster_answers_more_points}
                />
                <p className="text-xs text-gray-500 mt-1">Points for answering at the end</p>
              </div>
            </div>

            {/* Faster answers get more points toggle */}
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 mb-3">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <span className="text-sm font-medium text-gray-700">Faster answers get more points</span>
              </label>
              <input
                type="checkbox"
                checked={question.faster_answers_more_points || false}
                onChange={(e) =>
                  handleFieldChange("faster_answers_more_points", e.target.checked)
                }
                className="w-4 h-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={isSaving}
              />
            </div>

            {/* Partial scoring toggle */}
            <div className={`flex items-center justify-between p-3 border rounded-lg ${
              questionType === "single" ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-gray-200"
            }`}>
              <label className={`flex items-center gap-3 flex-1 ${
                questionType === "single" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}>
                <span className="text-sm font-medium text-gray-700">Partial scoring</span>
              </label>
              <input
                type="checkbox"
                checked={question.partial_scoring || false}
                onChange={(e) =>
                  handleFieldChange("partial_scoring", e.target.checked)
                }
                disabled={isSaving || questionType === "single"}
                className={`w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                  questionType === "single" ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                }`}
              />
            </div>
            {questionType === "single" && (
              <p className="text-xs text-gray-500 mt-2 ml-1">
                Partial scoring is not available for Single Choice questions
              </p>
            )}
          </div>

          {/* Leaderboard Toggle */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={safeSlide.show_leaderboard_after || false}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  handleSlideFieldChange("show_leaderboard_after", isChecked);
                  
                  // Ø§ÛŒØ¬Ø§Ø¯ ÛŒØ§ Ø­Ø°Ù Ø§Ø³Ù„Ø§ÛŒØ¯ Ù„ÛŒØ¯Ø±Ø¨Ø±Ø¯
                  // if (isChecked && onCreateLeaderboardSlide) {
                  //   onCreateLeaderboardSlide(slide.order);
                  // } else if (!isChecked && onDeleteLeaderboardSlide) {
                  //   onDeleteLeaderboardSlide(slide.order);
                  // }
                }}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 cursor-pointer text-blue-600 focus:ring-blue-500"
                disabled={isSaving}
              />
              <div>
                <span className="text-sm font-medium text-gray-800 block">Show Leaderboard</span>
                <p className="text-xs text-gray-600 mt-1">Display leaderboard after this question ends</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Leaderboard Title (only for leaderboard slides) */}
      {/* {safeSlide.slide_type === 3 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Leaderboard Title</h3>
          <input
            type="text"
            placeholder="Leaderboard"
            value={safeSlide.title || ""}
            onChange={(e) =>
              handleSlideFieldChange("title", e.target.value)
            }
            className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isSaving}
          />
        </div>
      )} */}


      {activeSlideType === 3 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Leaderboard Title</h3>
          
        </div>
      )}








      {/* Ø¯Ú©Ù…Ù‡â€ŒÙ‡Ø§ÛŒ Cancel Ùˆ Save Changes */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasChanges || isSaving}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
              hasChanges && !isSaving
                ? "bg-pink-600 text-white hover:bg-pink-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
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
            ? "Click 'Save Changes' to update slide settings"
            : isSaving 
            ? "Saving changes to server..."
            : "No changes to save"
          }
        </p>
      </div>
    </div>
  );
}

