import type { ComponentType, ReactNode } from "react";

import Notice, {
  type NoticeTone,
} from "../../../../shared/ui/Notice.tsx";
import type { EditorSlide } from "../../model/editor.ts";
import {
  resolveEditorItemRegistration,
  type EditorItemRegistryKey,
} from "../../model/itemRegistry.ts";
import ContentCanvas from "../canvas/ContentCanvas.tsx";
import QuestionCanvas from "../canvas/QuestionCanvas.tsx";
import WordCloudCanvas from "../canvas/WordCloudCanvas.tsx";
import ContentInspector from "../inspector/ContentInspector.tsx";
import QuestionInspector from "../inspector/QuestionInspector.tsx";
import WordCloudInspector from "../inspector/WordCloudInspector.tsx";
import ContentDraftProvider from "../model/ContentDraftProvider.tsx";
import QuestionDraftProvider from "../model/QuestionDraftProvider.tsx";
import WordCloudDraftProvider from "../model/WordCloudDraftProvider.tsx";

export type EditorCanvasProps = {
  slide: EditorSlide;
  quizBackground?: string;
  quizBackgroundImage?: string;
  textColor?: string;
  isFullSize?: boolean;
};

export type EditorInspectorProps = {
  quizId: string;
  slide: EditorSlide;
  onClose: (forceClose?: boolean) => void;
  onSlideUpdated: (slide: EditorSlide) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onNotify?: (message: string, tone?: NoticeTone) => void;
  onConflict?: () => void | Promise<void>;
};

type DraftBoundaryProps = {
  slide: EditorSlide | null;
  active: boolean;
  children: ReactNode;
};

type EditorRenderRegistration = {
  key: EditorItemRegistryKey;
  DraftBoundary: ComponentType<DraftBoundaryProps>;
  Canvas: ComponentType<EditorCanvasProps>;
  Inspector: ComponentType<EditorInspectorProps>;
};

function ChoiceDraftBoundary({
  slide,
  active,
  children,
}: DraftBoundaryProps) {
  return (
    <QuestionDraftProvider slide={slide} active={active}>
      {children}
    </QuestionDraftProvider>
  );
}

function ContentDraftBoundary({
  slide,
  active,
  children,
}: DraftBoundaryProps) {
  return (
    <ContentDraftProvider slide={slide} active={active}>
      {children}
    </ContentDraftProvider>
  );
}

function WordCloudDraftBoundary({
  slide,
  active,
  children,
}: DraftBoundaryProps) {
  return (
    <WordCloudDraftProvider slide={slide} active={active}>
      {children}
    </WordCloudDraftProvider>
  );
}

function ContentCanvasAdapter(props: EditorCanvasProps) {
  return (
    <ContentCanvas
      slide={props.slide}
      quizBackground={props.quizBackground}
      quizBackgroundImage={props.quizBackgroundImage}
      textColor={props.textColor}
    />
  );
}

const renderRegistry: Record<
  EditorItemRegistryKey,
  EditorRenderRegistration
> = {
  choice: {
    key: "choice",
    DraftBoundary: ChoiceDraftBoundary,
    Canvas: QuestionCanvas,
    Inspector: QuestionInspector,
  },
  text: {
    key: "text",
    DraftBoundary: WordCloudDraftBoundary,
    Canvas: WordCloudCanvas,
    Inspector: WordCloudInspector,
  },
  content: {
    key: "content",
    DraftBoundary: ContentDraftBoundary,
    Canvas: ContentCanvasAdapter,
    Inspector: ContentInspector,
  },
};

const resolveRenderRegistration = (
  slide: EditorSlide,
): EditorRenderRegistration | null => {
  const registration = resolveEditorItemRegistration(slide);
  return registration ? renderRegistry[registration.key] : null;
};

export function EditorItemDraftBoundary({
  slide,
  active,
  children,
}: DraftBoundaryProps) {
  if (!slide) return <>{children}</>;
  const registration = resolveRenderRegistration(slide);
  if (!registration) return <>{children}</>;

  const Boundary = registration.DraftBoundary;
  return (
    <Boundary slide={slide} active={active}>
      {children}
    </Boundary>
  );
}

export function EditorItemCanvas(props: EditorCanvasProps) {
  const registration = resolveRenderRegistration(props.slide);
  if (!registration) return null;

  const Canvas = registration.Canvas;
  return <Canvas {...props} />;
}

export function EditorItemInspector(props: EditorInspectorProps) {
  const registration = resolveRenderRegistration(props.slide);
  if (!registration) {
    return (
      <Notice tone="warning" className="m-3">
        برای این نوع آیتم هنوز ویرایشگر ثبت نشده است.
      </Notice>
    );
  }

  const Inspector = registration.Inspector;
  return <Inspector {...props} />;
}
