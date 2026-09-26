import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createRequestId } from "../../api/liveApi.ts";
import type { LivePresentationModel } from "../../model/presentation.ts";
import type { LegacyQuestionSlide } from "../../model/serverData.ts";
import { resolveQuestionTimer } from "../../model/questionTimer.ts";
import { useLiveSession } from "../../react/useLiveSession.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";

type SubmitState =
  | "idle"
  | "sending"
  | "retryable"
  | "sent"
  | "rejected"
  | "expired";

const responseTerms = (value: string): string[] =>
  (
    value
      .normalize("NFKC")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}\p{M}\u200c\u200d'’]+/gu) ?? []
  )
    .map((raw) =>
      raw.replace(/^['’\u200c\u200d]+|['’\u200c\u200d]+$/gu, ""),
    )
    .filter(Boolean);

export function ParticipantWordCloud({
  roomId,
  question,
  quiz,
}: {
  roomId?: string;
  question: LegacyQuestionSlide;
  quiz: LivePresentationModel;
}) {
  const { submitAnswer, isConnected, connectionError, snapshot } = useLiveSession();
  const identity = String(question.question_id ?? question.slide_id ?? "");
  const timerScope = String(roomId ?? "unknown") + ":" + identity + ":" + String(question.run_id ?? "na");
  const maxLength = Math.max(1, Number(question.response_max_length ?? 80));
  const maxWords = Math.max(1, Number(question.response_max_words ?? 3));
  const [value, setValue] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const questionRef = useRef(question);
  questionRef.current = question;
  const timerRef = useRef({ anchorStartMs: Date.now(), totalSeconds: 0 });
  const remainingRef = useRef(0);
  const pendingRef = useRef<{ requestId: string; text: string } | null>(null);
  const inFlightRef = useRef(false);
  const wasConnectedRef = useRef(isConnected);

  useEffect(() => {
    const resolved = resolveQuestionTimer({
      question: questionRef.current,
      roomId,
      role: "player",
    });
    timerRef.current = {
      anchorStartMs: resolved.anchorStartMs,
      totalSeconds: resolved.totalSeconds,
    };
    remainingRef.current = resolved.remainingSeconds;
    setTimeLeft(resolved.remainingSeconds);
    setTotalSeconds(resolved.totalSeconds);
    setValue("");
    setSubmitState("idle");
    setSubmitMessage("");
    pendingRef.current = null;
    inFlightRef.current = false;
  }, [roomId, timerScope]);

  useEffect(() => {
    const alreadySubmitted =
      snapshot?.role === "participant" &&
      snapshot.has_responded &&
      String(snapshot.session.active_item_id ?? "") === identity;
    if (!alreadySubmitted) return;

    pendingRef.current = null;
    inFlightRef.current = false;
    setSubmitState("sent");
    setSubmitMessage("پاسخ شما قبلاً ثبت شده است.");
  }, [identity, snapshot]);

  useEffect(() => {
    if (!identity || totalSeconds <= 0) return;
    let frame = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const elapsed = (Date.now() - timerRef.current.anchorStartMs) / 1000;
      const remaining = Math.max(
        0,
        timerRef.current.totalSeconds - elapsed,
      );
      remainingRef.current = remaining;
      setTimeLeft(remaining);
      if (remaining > 0) frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [identity, totalSeconds]);

  const terms = useMemo(() => responseTerms(value), [value]);
  const normalized = value.normalize("NFKC").trim();
  const tooLong = Array.from(normalized).length > maxLength;
  const tooManyWords = terms.length > maxWords;
  const locked = ["sending", "sent", "rejected", "expired"].includes(submitState);
  const canSubmit =
    Boolean(normalized) &&
    !tooLong &&
    !tooManyWords &&
    terms.length > 0 &&
    timeLeft > 0 &&
    !locked;

  const send = useCallback(
    async (attempt: { requestId: string; text: string }) => {
      if (inFlightRef.current || remainingRef.current <= 0) return;
      inFlightRef.current = true;
      setSubmitState("sending");
      setSubmitMessage("در حال ارسال پاسخ…");
      try {
        const outcome = await submitAnswer({
          request_id: attempt.requestId,
          activity_item_id: identity,
          response: { text: attempt.text },
        });
        if (outcome === true) {
          pendingRef.current = null;
          setSubmitState("sent");
          setSubmitMessage("پاسخ شما ثبت شد.");
        } else if (outcome === "rejected") {
          pendingRef.current = null;
          setSubmitState("rejected");
          setSubmitMessage("پاسخ پذیرفته نشد؛ محدودیت پاسخ یا زمان را بررسی کنید.");
        } else {
          pendingRef.current = attempt;
          setSubmitState("retryable");
          setSubmitMessage("ارسال کامل نشد. متن شما حفظ شده است؛ دوباره تلاش کنید.");
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [identity, submitAnswer],
  );

  const submit = async () => {
    if (!canSubmit) return;
    const attempt = {
      requestId: createRequestId(),
      text: normalized,
    };
    pendingRef.current = attempt;
    await send(attempt);
  };

  const retry = async () => {
    const attempt = pendingRef.current;
    if (attempt) await send(attempt);
  };

  useEffect(() => {
    const reconnected = !wasConnectedRef.current && isConnected;
    wasConnectedRef.current = isConnected;
    if (
      reconnected &&
      submitState === "retryable" &&
      pendingRef.current &&
      remainingRef.current > 0
    ) {
      void send(pendingRef.current);
    }
  }, [isConnected, send, submitState]);

  useEffect(() => {
    if (timeLeft > 0 || locked) return;
    pendingRef.current = null;
    setSubmitState("expired");
    setSubmitMessage(
      normalized
        ? "زمان پاسخ‌گویی پایان یافت و پاسخ ارسال نشد."
        : "زمان پاسخ‌گویی پایان یافت.",
    );
  }, [locked, normalized, timeLeft]);

  const progressPercent =
    totalSeconds > 0
      ? Math.max(0, Math.min(100, (timeLeft / totalSeconds) * 100))
      : 0;

  return (
    <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
      <section className="flex flex-1 flex-col py-3">
        {connectionError ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-amber-300/30 bg-amber-950/25 px-4 py-3 text-center text-sm"
          >
            ارتباط زنده ناپایدار است؛ متن شما روی این دستگاه حفظ شده است.
          </p>
        ) : null}

        <div className="flex flex-1 flex-col rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-4 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="flex items-center justify-between gap-3 text-sm font-bold text-[color:var(--live-muted)]">
            <span>
              تا {maxWords.toLocaleString("fa-IR")} واژه بنویسید
            </span>
            <span
              className="shrink-0 rounded-full bg-white/10 px-3 py-1"
              role="timer"
              aria-label={Math.ceil(timeLeft).toLocaleString("fa-IR") + " ثانیه باقی مانده"}
            >
              {Math.ceil(timeLeft).toLocaleString("fa-IR")} ثانیه
            </span>
          </div>

          <div
            className="my-4 h-2 overflow-hidden rounded-full bg-black/20"
            role="progressbar"
            aria-label="زمان باقی‌مانده"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
          >
            <div
              className="h-full rounded-full bg-white transition-[width] duration-150 motion-reduce:transition-none"
              style={{ width: progressPercent + "%" }}
            />
          </div>

          <h1
            className="text-center text-2xl font-black leading-10 sm:text-3xl"
            dir="auto"
          >
            {question.question_text || "ابر واژه"}
          </h1>

          <label className="mt-6 block">
            <span className="sr-only">پاسخ متنی شما</span>
            <textarea
              dir="auto"
              rows={4}
              value={value}
              disabled={locked || timeLeft <= 0}
              onChange={(event) => {
                setValue(event.target.value);
                if (submitState === "retryable") {
                  pendingRef.current = null;
                  setSubmitState("idle");
                  setSubmitMessage("");
                }
              }}
              placeholder="واژه‌های خود را بنویسید…"
              className="min-h-32 w-full resize-none rounded-2xl border-2 border-[color:var(--live-border)] bg-white/10 px-4 py-3 text-lg font-bold outline-none placeholder:text-[color:var(--live-muted)] focus:border-white focus:ring-4 focus:ring-white/20 disabled:opacity-60"
              aria-invalid={tooLong || tooManyWords}
            />
          </label>

          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-[color:var(--live-muted)]">
            <span>
              {terms.length.toLocaleString("fa-IR")} / {maxWords.toLocaleString("fa-IR")} واژه
            </span>
            <span>
              {Array.from(normalized).length.toLocaleString("fa-IR")} / {maxLength.toLocaleString("fa-IR")} نویسه
            </span>
          </div>
          {(tooLong || tooManyWords) && (
            <p role="alert" className="mt-2 text-sm font-bold text-warning">
              {tooManyWords
                ? "تعداد واژه‌ها از محدودیت این فعالیت بیشتر است."
                : "متن پاسخ بیش از حد طولانی است."}
            </p>
          )}

          <div className="mt-auto pt-5">
            {submitState === "retryable" && timeLeft > 0 ? (
              <button
                type="button"
                onClick={() => void retry()}
                className="min-h-14 w-full rounded-2xl bg-white px-5 text-base font-black text-slate-950 shadow-xl"
              >
                تلاش دوباره برای ارسال
              </button>
            ) : (
              <button
                type="button"
                className="min-h-14 w-full rounded-2xl bg-white px-5 text-lg font-black text-slate-950 shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => void submit()}
                disabled={!canSubmit}
              >
                {submitState === "sending"
                  ? "در حال ارسال…"
                  : submitState === "sent"
                    ? "پاسخ ثبت شد"
                    : submitState === "expired"
                      ? "زمان پایان یافت"
                      : "ثبت پاسخ"}
              </button>
            )}
            {submitMessage ? (
              <p
                role={submitState === "rejected" ? "alert" : "status"}
                className="mt-3 text-center text-sm text-[color:var(--live-muted)]"
              >
                {submitMessage}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </ParticipantShell>
  );
}
