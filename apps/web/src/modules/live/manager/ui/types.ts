import type { LivePresentationModel } from "../../model/presentation.ts";

export type ManagerStageProps = {
  roomId?: string;
  quiz: LivePresentationModel;
  currentSlide: number;
  totalSlides: number;
  onNext: () => void;
  onEndGame: () => void;
};
