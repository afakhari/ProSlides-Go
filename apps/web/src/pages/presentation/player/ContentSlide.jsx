import { ParticipantShell } from "../../../modules/live/participant/ParticipantShell";

export default function PlayerContentSlide({ quiz, content }) {
  const title = content?.title || content?.content_title || "مطلب بعدی";
  const text = content?.content_text || content?.text || "";
  const image = content?.content_image_url || content?.image_url || content?.image || "";

  return (
    <ParticipantShell quiz={quiz}>
      <article className="flex flex-1 flex-col justify-center py-5 text-center">
        <div className="rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-5 shadow-2xl backdrop-blur-xl sm:p-9">
          <p className="mb-3 text-sm font-bold text-[color:var(--live-muted)]">اسلاید توضیحی</p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl" dir="auto">{title}</h1>
          {image && <img src={image} alt="" className="mx-auto mt-6 max-h-[42dvh] w-auto max-w-full rounded-2xl border border-[color:var(--live-border)] object-contain shadow-xl" />}
          {text && <p className="mx-auto mt-6 max-w-2xl whitespace-pre-wrap text-lg leading-9 text-[color:var(--live-muted)]" dir="auto">{text}</p>}
          <div className="mx-auto mt-7 inline-flex rounded-full border border-[color:var(--live-border)] bg-white/10 px-4 py-2 text-sm font-bold">برای ادامه، نمایشگر ارائه‌دهنده را دنبال کنید</div>
        </div>
      </article>
    </ParticipantShell>
  );
}
