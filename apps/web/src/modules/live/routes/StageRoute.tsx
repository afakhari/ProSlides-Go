import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";

import { getColorForUser } from "../../../shared/lib/playerColor.ts";
import { presentationTheme } from "../../../shared/styles/presentationTheme.ts";
import type { StageRankingEntry, StageSnapshot } from "../api/types.ts";
import type {
  LegacyContentSlide,
  LegacyQuestionSlide,
} from "../model/serverData.ts";
import { normalizeLiveSlide } from "../runtime/protocol.ts";
import { useStageProjection } from "../stage/useStageProjection.ts";
import Waiting from "../ui/WaitingScreen.tsx";

const statusText = (snapshot: StageSnapshot) => {
  if (snapshot.session.state === "lobby") return "اتاق انتظار";
  if (snapshot.session.state === "ended") return "پایان جلسه";
  if (snapshot.session.stage_view === "overall_ranking") return "رتبه‌بندی کلی";
  if (snapshot.session.activity_phase === "revealed") return "نتیجه فعالیت";
  if (snapshot.session.activity_phase === "closed") return "پاسخ‌گویی بسته";
  return "در حال ارائه";
};

function StageHeader({
  snapshot,
  connected,
}: {
  snapshot: StageSnapshot;
  connected: boolean;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 backdrop-blur sm:px-6">
      <div className="min-w-0">
        <p className="font-outfit text-lg font-black" dir="ltr">ProSlides</p>
        <p className="truncate text-xs text-[color:var(--live-muted)]" dir="auto">
          {snapshot.presentation.title}
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <span className="hidden rounded-full bg-white/10 px-3 py-1.5 sm:inline">
          {snapshot.participant_count.toLocaleString("fa-IR")} شرکت‌کننده
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1.5" dir="ltr">
          {snapshot.join_code}
        </span>
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-white/10"
          role="status"
          aria-label={connected ? "Stage متصل است" : "Stage در حال بازیابی اتصال است"}
          title={connected ? "متصل" : "در حال بازیابی اتصال"}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-success" : "bg-warning"}`}
            aria-hidden="true"
          />
        </span>
      </div>
    </header>
  );
}

function StageLobby({ snapshot }: { snapshot: StageSnapshot }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const joinUrl = useMemo(() => {
    const origin =
      typeof window === "undefined"
        ? "https://proslides.ir"
        : window.location.origin;
    return `${origin}/${snapshot.join_code}`;
  }, [snapshot.join_code]);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(joinUrl, {
      margin: 2,
      width: 320,
      errorCorrectionLevel: "M",
    }).then((value) => {
      if (active) setQrDataUrl(value);
    });
    return () => {
      active = false;
    };
  }, [joinUrl]);

  return (
    <main className="grid min-h-screen place-items-center px-5 pb-10 pt-24 text-center">
      <section className="w-full max-w-5xl rounded-[2.5rem] border border-white/10 bg-[color:var(--live-surface)] p-8 shadow-2xl backdrop-blur sm:p-12">
        <p className="text-sm font-bold text-[color:var(--live-muted)]">برای پیوستن به جلسه</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl" dir="auto">
          {snapshot.presentation.title}
        </h1>
        <div className="mx-auto mt-9 grid max-w-3xl items-center gap-6 rounded-3xl border border-white/15 bg-black/20 px-6 py-7 sm:grid-cols-[1fr_auto] sm:text-start">
          <div>
            <p className="text-sm text-[color:var(--live-muted)]">
              کد ورود
            </p>
            <p
              className="mt-2 font-outfit text-5xl font-black tracking-[0.18em] sm:text-7xl"
              dir="ltr"
            >
              {snapshot.join_code}
            </p>
            <p
              className="mt-4 truncate text-sm text-[color:var(--live-muted)]"
              dir="ltr"
            >
              {joinUrl.replace(/^https?:\/\//, "")}
            </p>
          </div>
          <div className="mx-auto grid h-48 w-48 place-items-center rounded-3xl bg-white p-3 shadow-xl sm:mx-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="کد QR ورود به جلسه"
                className="h-full w-full"
              />
            ) : (
              <span className="text-xs text-slate-500" role="status">
                در حال ساخت QR…
              </span>
            )}
          </div>
        </div>
        <p className="mt-7 text-xl font-bold">
          {snapshot.participant_count.toLocaleString("fa-IR")} نفر آماده‌اند
        </p>
      </section>
    </main>
  );
}

function StageContent({ content }: { content: LegacyContentSlide }) {
  return (
    <main className="flex min-h-screen items-center px-5 pb-12 pt-24 sm:px-8">
      <article className="mx-auto w-full max-w-6xl rounded-[2.5rem] border border-white/10 bg-[color:var(--live-surface)] p-7 text-center shadow-2xl backdrop-blur sm:p-12">
        {content.title ? (
          <h1 className="text-4xl font-black leading-tight sm:text-6xl" dir="auto">
            {content.title}
          </h1>
        ) : null}
        {content.content_text ? (
          <p className="mx-auto mt-7 max-w-4xl whitespace-pre-wrap text-xl leading-10 text-[color:var(--live-muted)] sm:text-2xl" dir="auto">
            {content.content_text}
          </p>
        ) : null}
        {content.content_image_url ? (
          <img
            src={content.content_image_url}
            alt={content.title || "تصویر محتوای ارائه"}
            className="mx-auto mt-8 max-h-[58dvh] max-w-full rounded-3xl object-contain shadow-2xl"
          />
        ) : null}
      </article>
    </main>
  );
}

function StageTimer({
  seconds,
  identity,
}: {
  seconds: number;
  identity: string;
}) {
  const [remaining, setRemaining] = useState(Math.max(0, seconds));

  useEffect(() => {
    const initial = Math.max(0, seconds);
    const startedAt = Date.now();
    setRemaining(initial);
    if (initial <= 0) return;

    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setRemaining(Math.max(0, initial - elapsed));
    }, 250);
    return () => window.clearInterval(timer);
  }, [identity, seconds]);

  return (
    <div
      className="mx-auto mt-5 grid h-24 w-24 place-items-center rounded-full border-4 border-white/15 bg-black/20 text-4xl font-black"
      role="timer"
      aria-label="زمان باقی‌مانده"
    >
      {Math.ceil(remaining).toLocaleString("fa-IR")}
    </div>
  );
}

function StageActivity({
  question,
  snapshot,
}: {
  question: LegacyQuestionSlide;
  snapshot: StageSnapshot;
}) {
  const revealed = snapshot.session.activity_phase === "revealed";
  const closed = snapshot.session.activity_phase === "closed";
  const result = snapshot.activity_result;
  const isWordCloud = question.activity_kind === "text";
  const counts = useMemo(() => {
    const map = new Map<number, number>();
    const choiceCounts =
      result?.activity_kind === "choice" && "option_counts" in result.payload
        ? result.payload.option_counts
        : {};
    for (const [index, count] of Object.entries(choiceCounts)) {
      map.set(Number(index), Number(count));
    }
    return map;
  }, [result]);
  const wordTerms =
    result?.activity_kind === "text" && "terms" in result.payload
      ? result.payload.terms
      : [];
  const maxTermCount = Math.max(
    1,
    ...wordTerms.map((term) => Math.max(0, Number(term.count))),
  );
  const total = Number(result?.response_count ?? 0);
  const options = question.options ?? [];
  const isPoll =
    !isWordCloud &&
    question.has_correct_answer === false &&
    question.is_scored === false;

  return (
    <main className="flex min-h-screen flex-col px-5 pb-10 pt-24 sm:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
        <div className="text-center">
          <p className="text-sm font-bold text-[color:var(--live-muted)]">
            {revealed
              ? isWordCloud
                ? "نتیجه ابر واژه"
                : isPoll
                  ? "نتیجه نظرسنجی"
                  : "نتیجه فعالیت"
              : closed
                ? "پاسخ‌گویی بسته شد"
                : isWordCloud
                  ? "ابر واژه"
                  : isPoll
                    ? "نظرسنجی"
                    : "فعالیت"}
          </p>
          <h1
            className="mx-auto mt-2 max-w-5xl text-3xl font-black leading-tight sm:text-5xl"
            dir="auto"
          >
            {question.question_text || question.question_title || "فعالیت"}
          </h1>
          {!revealed &&
          !closed &&
          Number(question.remaining_seconds ?? 0) > 0 ? (
            <StageTimer
              seconds={Number(question.remaining_seconds ?? 0)}
              identity={String(question.question_id ?? question.slide_id ?? "") + ":" + String(snapshot.session.state_version)}
            />
          ) : null}
          {revealed ? (
            <p className="mt-3 text-sm text-[color:var(--live-muted)]">
              {total.toLocaleString("fa-IR")} پاسخ ثبت‌شده
            </p>
          ) : null}
        </div>

        {isWordCloud ? (
          <div
            className="mt-8 flex min-h-[18rem] flex-1 flex-wrap items-center justify-center gap-x-7 gap-y-5 rounded-[2.5rem] border border-white/10 bg-white/5 p-7 shadow-2xl"
            aria-label={revealed ? "ابر واژه نتیجه" : "در انتظار پاسخ‌های ابر واژه"}
          >
            {!revealed ? (
              <p className="max-w-2xl text-center text-lg font-bold leading-8 text-[color:var(--live-muted)]">
                پاسخ‌ها در حال جمع‌آوری هستند. ابر واژه پس از نمایش نتیجه روی
                Stage ظاهر می‌شود.
              </p>
            ) : wordTerms.length === 0 ? (
              <p className="text-center text-lg text-[color:var(--live-muted)]">
                هنوز واژه‌ای برای نمایش وجود ندارد.
              </p>
            ) : (
              wordTerms.map((term) => {
                const ratio = Math.max(0.3, term.count / maxTermCount);
                return (
                  <span
                    key={term.text}
                    dir="auto"
                    className="font-black leading-none"
                    style={{ fontSize: 22 + Math.round(ratio * 48) }}
                    aria-label={
                      term.text +
                      "، " +
                      term.count.toLocaleString("fa-IR") +
                      " بار"
                    }
                  >
                    {term.text}
                  </span>
                );
              })
            )}
          </div>
        ) : (
          <div className="mt-8 grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {options.map((option, index) => {
              const count = counts.get(index) ?? 0;
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const correct = revealed && option.answer === true;
              return (
                <article
                  key={String(option.option_id ?? index)}
                  className={
                    "flex min-h-44 flex-col overflow-hidden rounded-3xl border p-5 shadow-xl " +
                    (correct
                      ? "border-success/70 bg-success/15"
                      : "border-white/10 bg-white/5")
                  }
                >
                  {option.image_url ? (
                    <img
                      src={option.image_url}
                      alt=""
                      className="mx-auto mb-4 max-h-28 max-w-full rounded-2xl object-contain"
                    />
                  ) : null}
                  <p className="text-center text-lg font-black" dir="auto">
                    {option.option_text}
                  </p>
                  {revealed ? (
                    <div className="mt-auto pt-5">
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-sm text-[color:var(--live-muted)]">
                          {correct ? "پاسخ صحیح" : ""}
                        </span>
                        <strong className="text-2xl">
                          {count.toLocaleString("fa-IR")}
                        </strong>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-current transition-[width] duration-500"
                          style={{
                            width:
                              Math.max(0, Math.min(100, percentage)) + "%",
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className="mx-auto mt-auto h-2 w-2/3 rounded-full"
                      style={{ backgroundColor: getColorForUser(index) }}
                      aria-hidden="true"
                    />
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function RankingList({
  ranking,
  title,
}: {
  ranking: StageRankingEntry[];
  title: string;
}) {
  const maxScore = Math.max(0, ...ranking.map((entry) => Number(entry.score || 0)));
  return (
    <main className="min-h-screen px-5 pb-10 pt-24 sm:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm font-bold text-[color:var(--live-muted)]">رتبه‌بندی تجمعی جلسه</p>
          <h1 className="mt-2 text-4xl font-black sm:text-6xl">{title}</h1>
        </div>
        <ol className="mt-9 space-y-4 rounded-[2.5rem] border border-white/10 bg-[color:var(--live-surface)] p-5 shadow-2xl backdrop-blur sm:p-7">
          {ranking.length === 0 ? (
            <li className="grid min-h-48 place-items-center text-[color:var(--live-muted)]">
              هنوز امتیازی برای نمایش وجود ندارد.
            </li>
          ) : ranking.map((entry, index) => {
            const width = maxScore > 0 ? Math.max(4, (entry.score / maxScore) * 100) : 0;
            return (
              <li key={`${entry.rank}:${entry.display_name}:${index}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-lg font-black">
                  {entry.rank.toLocaleString("fa-IR")}
                </span>
                <div className="relative min-h-14 overflow-hidden rounded-2xl bg-white/5">
                  <span
                    className="absolute inset-y-0 start-0 rounded-2xl bg-white/10"
                    style={{ width: `${width}%` }}
                    aria-hidden="true"
                  />
                  <span className="relative z-10 flex min-h-14 items-center gap-3 px-4">
                    <span className="text-2xl" aria-hidden="true">{entry.avatar || "🙂"}</span>
                    <span className="truncate font-black" dir="auto">{entry.display_name}</span>
                  </span>
                </div>
                <strong className="min-w-24 text-end">
                  {Math.round(entry.score).toLocaleString("fa-IR")} امتیاز
                </strong>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}

const medalForRank = (rank: number) =>
  rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅";

function StageFinal({ snapshot }: { snapshot: StageSnapshot }) {
  if (!snapshot.has_scoring) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-10 pt-24 text-center">
        <section className="max-w-2xl rounded-[2.5rem] border border-white/10 bg-[color:var(--live-surface)] p-10 shadow-2xl backdrop-blur">
          <p className="text-sm font-bold text-[color:var(--live-muted)]">جلسه پایان یافت</p>
          <h1 className="mt-3 text-4xl font-black sm:text-6xl">ممنون از مشارکت شما</h1>
          <p className="mt-5 leading-8 text-[color:var(--live-muted)]">
            این جلسه فعالیت امتیازی نداشت؛ بنابراین رتبه‌بندی نهایی نمایش داده نمی‌شود.
          </p>
        </section>
      </main>
    );
  }

  const podium = snapshot.ranking.slice(0, 3);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 pb-10 pt-24 text-center">
      <p className="text-sm font-bold text-[color:var(--live-muted)]">پایان جلسه</p>
      <h1 className="mt-2 text-4xl font-black sm:text-6xl">برترین‌های این رقابت</h1>
      <div className="mt-10 grid w-full max-w-5xl gap-5 md:grid-cols-3">
        {podium.map((entry, index) => (
          <article
            key={`${entry.rank}:${entry.display_name}:${index}`}
            className="rounded-[2rem] border border-white/15 bg-[color:var(--live-surface)] p-7 shadow-2xl backdrop-blur"
          >
            <div className="text-5xl" aria-hidden="true">{medalForRank(entry.rank)}</div>
            <p className="mt-4 text-4xl font-black">{entry.rank.toLocaleString("fa-IR")}</p>
            <h2 className="mt-4 truncate text-2xl font-black" dir="auto">{entry.display_name}</h2>
            <p className="mt-2 text-[color:var(--live-muted)]">
              {Math.round(entry.score).toLocaleString("fa-IR")} امتیاز
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}

export default function StageRoute() {
  const { roomId } = useParams<{ roomId: string }>();
  const { snapshot, isConnected, isLoading, error } = useStageProjection(roomId);

  if (isLoading && !snapshot) {
    return <Waiting message="در حال آماده‌سازی Stage…" />;
  }
  if (!snapshot) {
    return <Waiting message={error || "Stage در دسترس نیست"} />;
  }

  const theme = presentationTheme({
    title: snapshot.presentation.title,
    background: {
      color: snapshot.presentation.background_color,
      image: snapshot.presentation.background_image_url,
      text_color: snapshot.presentation.text_color,
    },
    text_color: snapshot.presentation.text_color,
  });
  const item = normalizeLiveSlide(snapshot.active_item, snapshot.session);

  let body;
  if (snapshot.session.state === "lobby" || snapshot.session.state === "draft") {
    body = <StageLobby snapshot={snapshot} />;
  } else if (snapshot.session.state === "ended") {
    body = <StageFinal snapshot={snapshot} />;
  } else if (snapshot.session.stage_view === "overall_ranking") {
    body = <RankingList ranking={snapshot.ranking} title="جدول امتیازات" />;
  } else if (item?.item_kind === "content") {
    body = <StageContent content={item} />;
  } else if (item?.item_kind === "activity") {
    body = <StageActivity question={item} snapshot={snapshot} />;
  } else {
    body = <Waiting message="در حال همگام‌سازی محتوای Stage…" />;
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-cover bg-center text-[color:var(--live-fg)]"
      style={theme.style}
      data-stage-surface="audience"
    >
      <StageHeader snapshot={snapshot} connected={isConnected} />
      {error && snapshot ? (
        <div
          className="fixed bottom-4 start-1/2 z-30 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs text-white backdrop-blur"
          role="status"
        >
          ارتباط Stage در حال بازیابی است
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {`وضعیت Stage: ${statusText(snapshot)}`}
      </span>
      {body}
    </div>
  );
}
