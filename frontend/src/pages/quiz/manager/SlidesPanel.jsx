import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Trophy } from "lucide-react";

export default function SlidesPanel({
  slides,
  activeSlideId,
  setActiveSlideId,
  addNewSlide,
  deleteSlide,
  reorderSlides,
  idKey = "question_id",
  titleKey = "question_text",
}) {
  return (
    <div>
      <h2 className="font-semibold mb-3">Slides</h2>

      <DragDropContext onDragEnd={reorderSlides}>
        <Droppable droppableId="slides">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-3"
            >
              {slides.map((slide, index) => {
                const bgImage = slide.backgroundImage
                  ? `url(${slide.backgroundImage})`
                  : "none";

                const bgColor = slide.backgroundImage
                  ? ""
                  : slide.backgroundColor || "#f3f3f3";

                return (
                  <Draggable
                    key={slide[idKey]}
                    draggableId={slide[idKey].toString()}
                    index={index}
                  >
                    {(provided, snapshot) => {
                      // merge library styles (transform/transition) with our inline styles
                      const mergedStyle = {
                        ...provided.draggableProps.style,
                        width: "330px",
                        height: "210px",
                        backgroundImage: bgImage,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundColor: bgColor,
                      };

                      return (
                        <div
                          {...provided.draggableProps} // draggable props on container
                          ref={provided.innerRef}
                          onClick={() => setActiveSlideId(slide[idKey])}
                          className={`relative cursor-pointer border rounded-lg overflow-hidden transition-all
                            ${slide[idKey] === activeSlideId
                              ? "border-blue-500 ring-2 ring-blue-300"
                              : "border-gray-300 hover:shadow-md"
                            }
                          `}
                          style={mergedStyle}
                        >
                          {/* Drag handle: only here spread dragHandleProps */}
                          <div
                            {...provided.dragHandleProps}
                            // stop propagation on mouseDown to avoid triggering container click
                            onMouseDown={(e) => {
                              // prevent container's onClick firing when starting a drag
                              e.stopPropagation();
                            }}
                            className={`absolute top-1 right-10 p-1.5 bg-white/90 rounded-md shadow-sm cursor-grab
                              hover:bg-white active:cursor-grabbing select-none z-20`}
                            title="Drag to reorder"
                            aria-label="Drag handle"
                          >
                            <GripVertical className="w-5 h-5 text-gray-700" />
                          </div>

                          {/* Delete button (stop propagation so click doesn't trigger select/drag) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSlide(slide[idKey]);
                            }}
                            className="absolute top-1 right-1 p-2 rounded-md bg-white/90 hover:bg-red-50 text-red-600 shadow-sm z-20"
                            title="Delete slide"
                            aria-label="Delete slide"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {/* Question text - wrap and don't overflow */}
                          <div
                            className="absolute top-10 left-2 right-2 text-sm font-semibold text-black/90 bg-white/80 p-2 rounded
                                      leading-tight overflow-hidden"
                            style={{
                              maxHeight: "110px",
                              wordBreak: "break-word",
                              whiteSpace: "normal",
                              WebkitLineClamp: 6,
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {slide.slide_type === 2 ? (
                              <div className="flex flex-col items-center gap-2">
                                <Trophy className="w-8 h-8 text-yellow-500" />
                                {slide.leaderboard_title || "Leaderboard"}
                              </div>
                            ) : (
                              slide[titleKey]
                            )}
                          </div>

                          {/* Question type at bottom */}
                          <div className="absolute bottom-2 left-2 right-2 text-xs text-center bg-white/80 py-1 rounded font-medium text-gray-700">
                            {slide.slide_type === 2 ? "Leaderboard" : slide.question_type}
                          </div>
                        </div>
                      );
                    }}
                  </Draggable>
                );
              })}

              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div
        onClick={addNewSlide}
        className="mt-4 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg p-4 text-center cursor-pointer hover:bg-green-100"
      >
        ➕ Add Slide
      </div>
    </div>
  );
}
