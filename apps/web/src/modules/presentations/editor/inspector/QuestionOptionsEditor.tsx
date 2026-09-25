import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import { Button } from "../../../../shared/ui/primitives/Button.tsx";
import {
  QUESTION_LIMITS,
  type EvaluationMode,
  type QuestionType,
  type QuestionValidationIssue,
} from "../../model/editor.ts";
import type { QuestionDraftOption } from "../model/questionDraft.ts";

type QuestionOptionsEditorProps = {
  options: QuestionDraftOption[];
  questionType: QuestionType;
  evaluationMode: EvaluationMode;
  disabled: boolean;
  issues: QuestionValidationIssue[];
  onAdd: () => void;
  onDelete: (optionId: string) => void;
  onTextChange: (optionId: string, value: string) => void;
  onToggleCorrect: (optionId: string) => void;
  onMove: (from: number, to: number) => void;
  onImage: (optionId: string) => void;
  onRemoveImage: (optionId: string) => void;
};

const optionIssue = (
  issues: QuestionValidationIssue[],
  optionId: string,
): string | null =>
  issues.find(
    (issue) =>
      issue.optionId === optionId &&
      (issue.field === "option_text" || issue.field === "option_image"),
  )?.message ?? null;

export default function QuestionOptionsEditor({
  options,
  questionType,
  evaluationMode,
  disabled,
  issues,
  onAdd,
  onDelete,
  onTextChange,
  onToggleCorrect,
  onMove,
  onImage,
  onRemoveImage,
}: QuestionOptionsEditorProps) {
  const globalIssue =
    issues.find(
      (issue) =>
        issue.field === "options" &&
        !issue.optionId,
    )?.message ?? null;
  const canDelete = options.length > QUESTION_LIMITS.minOptions;
  const canAdd = options.length < QUESTION_LIMITS.maxOptions;
  const correctnessDisabled =
    disabled || evaluationMode === "none";

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    onMove(result.source.index, result.destination.index);
  };

  return (
    <section aria-labelledby="question-options-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="question-options-heading" tabIndex={-1} className="text-sm font-semibold text-content outline-none">
            گزینه‌های پاسخ
          </h3>
          <p className="mt-1 text-xs leading-5 text-content-muted">
            {evaluationMode === "none"
              ? "این فعالیت پاسخ صحیح ندارد و فقط توزیع انتخاب‌ها را ثبت می‌کند."
              : questionType === "single"
                ? "دقیقاً یک پاسخ صحیح انتخاب کنید."
                : "یک یا چند پاسخ صحیح انتخاب کنید."}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">
          {evaluationMode === "none"
            ? "بدون پاسخ صحیح"
            : questionType === "single"
              ? "تک‌گزینه‌ای"
              : "چندگزینه‌ای"}
        </span>
      </div>

      {globalIssue && (
        <p role="alert" className="mt-3 rounded-control border border-danger-border bg-danger-soft px-3 py-2 text-xs text-danger-ink">
          {globalIssue}
        </p>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="question-options">
          {(droppableProvided) => (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              className="mt-3 space-y-2"
            >
              {options.map((option, index) => {
                const error = optionIssue(issues, option.id);
                const textId = `question-option-${option.id}`;
                const errorId = `${textId}-error`;

                return (
                  <Draggable
                    key={option.id}
                    draggableId={option.id}
                    index={index}
                    isDragDisabled={disabled}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`rounded-panel border bg-surface p-2.5 transition ${
                          snapshot.isDragging
                            ? "border-brand shadow-panel"
                            : error
                              ? "border-danger-border"
                              : "border-border-subtle"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            aria-label={`جابه‌جایی گزینه ${formatPersianNumber(index + 1)}`}
                            title="برای جابه‌جایی بکشید یا از دکمه‌های بالا و پایین استفاده کنید"
                            className="size-9 shrink-0 cursor-grab touch-none active:cursor-grabbing"
                            {...provided.dragHandleProps}
                          >
                            <GripVertical aria-hidden="true" />
                          </Button>

                          {evaluationMode === "none" ? (
                            <span
                              className="grid size-9 shrink-0 place-items-center rounded-control bg-brand-soft text-xs font-black text-brand-ink"
                              aria-hidden="true"
                            >
                              {formatPersianNumber(index + 1)}
                            </span>
                          ) : (
                            <Button
                              variant={option.isCorrect ? "secondary" : "outline"}
                              size="icon"
                              disabled={correctnessDisabled}
                              aria-pressed={option.isCorrect}
                              aria-label={
                                option.isCorrect
                                  ? `گزینه ${formatPersianNumber(index + 1)} پاسخ صحیح است`
                                  : `انتخاب گزینه ${formatPersianNumber(index + 1)} به‌عنوان پاسخ صحیح`
                              }
                              className="size-9 shrink-0"
                              onClick={() => onToggleCorrect(option.id)}
                            >
                              {option.isCorrect ? (
                                <CheckCircle2 aria-hidden="true" />
                              ) : (
                                <Circle aria-hidden="true" />
                              )}
                            </Button>
                          )}

                          <div className="min-w-0 flex-1">
                            <label htmlFor={textId} className="sr-only">
                              متن گزینه {formatPersianNumber(index + 1)}
                            </label>
                            <input
                              id={textId}
                              type="text"
                              dir="auto"
                              value={option.text}
                              maxLength={QUESTION_LIMITS.optionText}
                              disabled={disabled}
                              aria-invalid={Boolean(error)}
                              aria-describedby={error ? errorId : undefined}
                              onChange={(event) =>
                                onTextChange(option.id, event.target.value)
                              }
                              placeholder={`متن گزینه ${formatPersianNumber(index + 1)}`}
                              className="h-9 w-full rounded-control border border-border-subtle bg-surface px-3 text-sm text-content outline-none transition placeholder:text-content-muted focus:border-brand focus:ring-2 focus:ring-focus/30 disabled:cursor-not-allowed disabled:opacity-60"
                            />

                            {error && (
                              <p id={errorId} role="alert" className="mt-1.5 text-xs text-danger-ink">
                                {error}
                              </p>
                            )}

                            {option.imageUrl && (
                              <div className="mt-2 flex items-center gap-2 rounded-control border border-border-subtle bg-canvas p-2">
                                <img
                                  src={option.imageUrl}
                                  alt=""
                                  className="size-14 shrink-0 rounded-control bg-surface object-cover"
                                />
                                <span dir="ltr" className="min-w-0 flex-1 truncate text-xs text-content-muted">
                                  {option.imageUrl}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={disabled}
                                  aria-label={`حذف تصویر گزینه ${formatPersianNumber(index + 1)}`}
                                  className="size-8 shrink-0 text-danger"
                                  onClick={() => onRemoveImage(option.id)}
                                >
                                  <X aria-hidden="true" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={disabled}
                              aria-label={`افزودن تصویر به گزینه ${formatPersianNumber(index + 1)}`}
                              className="size-9"
                              onClick={() => onImage(option.id)}
                            >
                              <ImageIcon aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={disabled || !canDelete}
                              aria-label={
                                canDelete
                                  ? `حذف گزینه ${formatPersianNumber(index + 1)}`
                                  : "حداقل دو گزینه لازم است"
                              }
                              className="size-9 text-danger"
                              onClick={() => onDelete(option.id)}
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2 flex justify-end gap-1 border-t border-border-subtle pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={disabled || index === 0}
                            aria-label={`انتقال گزینه ${formatPersianNumber(index + 1)} به بالا`}
                            onClick={() => onMove(index, index - 1)}
                          >
                            <ChevronUp aria-hidden="true" />
                            بالا
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={disabled || index === options.length - 1}
                            aria-label={`انتقال گزینه ${formatPersianNumber(index + 1)} به پایین`}
                            onClick={() => onMove(index, index + 1)}
                          >
                            <ChevronDown aria-hidden="true" />
                            پایین
                          </Button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <Button
        variant="outline"
        className="mt-3 w-full border-dashed"
        disabled={disabled || !canAdd}
        onClick={onAdd}
      >
        <Plus aria-hidden="true" />
        {canAdd
          ? "افزودن گزینه"
          : `حداکثر ${formatPersianNumber(QUESTION_LIMITS.maxOptions)} گزینه`}
      </Button>
    </section>
  );
}
