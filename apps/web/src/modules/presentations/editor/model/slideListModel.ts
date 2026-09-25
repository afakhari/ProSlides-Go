import type {
  EditorPresentation,
  EditorSlide,
} from "../../model/editor.ts";
import {
  getEditorItemTitle,
  getEditorItemTypeLabel,
} from "../../model/itemRegistry.ts";

export type SlideListItem = EditorSlide;

export const buildSlideListItems = (
  slides: EditorSlide[],
): SlideListItem[] => slides;

export const reorderEditorSlides = (
  slides: EditorSlide[],
  sourceIndex: number,
  destinationIndex: number,
): EditorSlide[] => {
  if (
    sourceIndex < 0 ||
    destinationIndex < 0 ||
    sourceIndex >= slides.length ||
    destinationIndex >= slides.length ||
    sourceIndex === destinationIndex
  ) {
    return slides;
  }

  const reordered = [...slides];
  const [moved] = reordered.splice(sourceIndex, 1);
  if (!moved) return slides;
  reordered.splice(destinationIndex, 0, moved);

  return reordered.map((slide, order) => ({ ...slide, order }));
};

export const presentationAfterReorder = (
  presentation: EditorPresentation,
  reorderedSlides: EditorSlide[],
): EditorPresentation => ({
  ...presentation,
  revision: presentation.revision + 1,
  slides: reorderedSlides.map((slide, order) => ({
    ...slide,
    order,
    revision: slide.revision + 1,
  })),
});

export const getSlideListTitle = (slide: SlideListItem): string =>
  getEditorItemTitle(slide);

export const getSlideListTypeLabel = (
  slide: SlideListItem,
): string => getEditorItemTypeLabel(slide);
