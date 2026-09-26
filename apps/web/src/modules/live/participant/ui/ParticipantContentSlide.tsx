import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyContentSlide } from "../../model/serverData.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";

type ParticipantContentSlideProps = {
  quiz: LivePresentationModel;
  content: LegacyContentSlide;
};

export function ParticipantContentSlide({
  quiz,
  content,
}: ParticipantContentSlideProps) {
  const { isStreamConnected } = useLiveSession();
  const title = content.title || "مطلب بعدی";
  const text = content.content_text || "";
  const image = content.content_image_url || "";

  return (
    <ParticipantShell quiz={quiz} connected={isStreamConnected} showConnection>
      <article className="flex flex-1 flex-col justify-center py-5 text-center">
        <div className="rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-5 shadow-2xl backdrop-blur-xl sm:p-9">
          <p className="mb-3 text-sm font-bold text-[color:var(--live-muted)]">
            اسلاید توضیحی
          </p>
          <h1
            className="text-3xl font-black leading-tight sm:text-4xl"
            dir="auto"
          >
            {title}
          </h1>

          {image ? (
            <img
              src={image}
              alt={title ? "تصویر " + title : "تصویر اسلاید توضیحی"}
              className="mx-auto mt-6 max-h-[42dvh] w-auto max-w-full rounded-2xl border border-[color:var(--live-border)] object-contain shadow-xl"
            />
          ) : null}

          {text ? (
            <p
              className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-lg leading-9 text-[color:var(--live-muted)]"
              dir="auto"
            >
              {text}
            </p>
          ) : null}

          <div
            className="mx-auto mt-7 inline-flex rounded-full border border-[color:var(--live-border)] bg-white/10 px-4 py-2 text-sm font-bold"
            role="status"
          >
            برای ادامه، نمایشگر ارائه‌دهنده را دنبال کنید
          </div>
        </div>
      </article>
    </ParticipantShell>
  );
}
