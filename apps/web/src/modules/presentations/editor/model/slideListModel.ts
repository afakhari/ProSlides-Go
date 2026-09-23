import type { EditorPresentation, EditorSlide } from "../../model/editor.ts";

export type SyntheticLeaderboardSlide = {
  slide_id: string;
  slide_type: 3;
  order: number;
  show_leaderboard_after: false;
  title: string | null;
  content_text: string | null;
  content_image_url: string | null;
  question: null;
  isSynthetic: true;
  sourceSlideId: string;
};

export type SlideListItem =
  | (EditorSlide & { isSynthetic: false; sourceSlideId?: never })
  | SyntheticLeaderboardSlide;

export const buildSlideListItems = (
  slides: EditorSlide[],
): SlideListItem[] =>
  slides.flatMap((slide) => {
    const item: SlideListItem = { ...slide, isSynthetic: false };
    if (slide.slide_type !== 1 || !slide.show_leaderboard_after) {
      return [item];
    }

    return [
      item,
      {
        slide_id: `leaderboard:${slide.slide_id}`,
        slide_type: 3,
        order: slide.order,
        show_leaderboard_after: false,
        title: "جدول امتیازات",
        content_text: null,
        content_image_url: null,
        question: null,
        isSynthetic: true,
        sourceSlideId: slide.slide_id,
      },
    ];
  });

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
