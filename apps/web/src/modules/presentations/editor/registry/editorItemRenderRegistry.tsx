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
import LeaderboardCanvas from "../canvas/LeaderboardCanvas.tsx";
import QuestionCanvas from "../canvas/QuestionCanvas.tsx";
import ContentInspector from "../inspector/ContentInspector.tsx";
import QuestionInspector from "../inspector/QuestionInspector.tsx";
import ContentDraftProvider from "../model/ContentDraftProvider.tsx";
import QuestionDraftProvider from "../model/QuestionDraftProvider.tsx";

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

function PassiveDraftBoundary({ children }: DraftBoundaryProps) {
  return <>{children}</>;
}

function ContentCanvasAdapter({
  isFullSize: _isFullSize,
  ...props
}: EditorCanvasProps) {
  return <ContentCanvas {...props} />;
}

function LegacyLeaderboardCanvas(props: EditorCanvasProps) {
  return <LeaderboardCanvas {...props} customLeaderboard={[]} />;
}

function LegacyLeaderboardInspector({
  onClose,
}: EditorInspectorProps) {
  return (
    <aside
      className="flex h-full min-h-0 flex-col bg-surface p-1 text-content"
      aria-label="آیتم قدیمی جدول امتیازات"
    >
      <Notice tone="warning" className="items-start">
        این آیتم از مدل قدیمی باقی مانده است. در مدل جدید، رتبه‌بندی کلی رفتار
        یک Activity است و اسلاید مستقل ساخته نمی‌شود. برای حذف یا بازطراحی این
        مورد از مسیر مهاجرت داده استفاده کنید.
      </Notice>
      <button
        type="button"
        onClick={() => onClose(true)}
        className="mt-4 min-h-11 rounded-control border border-border-subtle px-4 text-sm font-bold hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        بستن
      </button>
    </aside>
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
  content: {
    key: "content",
    DraftBoundary: ContentDraftBoundary,
    Canvas: ContentCanvasAdapter,
    Inspector: ContentInspector,
  },
  "legacy-leaderboard": {
    key: "legacy-leaderboard",
    DraftBoundary: PassiveDraftBoundary,
    Canvas: LegacyLeaderboardCanvas,
    Inspector: LegacyLeaderboardInspector,
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
