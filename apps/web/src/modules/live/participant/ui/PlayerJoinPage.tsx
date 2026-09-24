import { useState, type FormEvent } from "react";
import EmojiPicker from "emoji-picker-react";
import { AnimatePresence, motion as Motion } from "framer-motion";

import type { LivePresentationModel } from "../../model/presentation.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";
import { useParticipantJoinController } from "../useParticipantJoinController.ts";

type PlayerJoinPageProps = {
  roomId?: string;
  quiz: LivePresentationModel;
};

export function PlayerJoinPage({ roomId, quiz }: PlayerJoinPageProps) {
  const controller = useParticipantJoinController(roomId);
  const [showPicker, setShowPicker] = useState(false);
  const {
    name,
    avatar,
    status,
    validation,
    isConnected,
    connectionError,
    setName,
    setAvatar,
    submitProfile,
    editProfile,
  } = controller;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitProfile();
  };

  const waiting = status === "connecting" || status === "joining" || status === "ready";

  if (waiting) {
    return (
      <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
        <section className="flex flex-1 flex-col items-center justify-center py-5 text-center">
          <Motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-6 shadow-2xl backdrop-blur-xl sm:p-10"
          >
            <div
              className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-3xl border border-[color:var(--live-border)] bg-white/10 text-6xl shadow-xl"
              aria-hidden="true"
            >
              {avatar}
            </div>
            <p className="text-sm text-[color:var(--live-muted)]">خوش آمدید</p>
            <h1 className="mt-1 text-3xl font-black" dir="auto">
              {name}
            </h1>
            <div className="mx-auto my-6 h-px w-20 bg-[color:var(--live-border)]" />
            <p className="text-xl font-bold">
              {status === "ready"
                ? "برای شروع کوئیز آماده باشید"
                : status === "joining"
                  ? "در حال ورود به جلسه…"
                  : "در حال برقراری اتصال…"}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--live-muted)]">
              به‌محض شروع سؤال، گزینه‌ها همین‌جا نمایش داده می‌شوند.
            </p>
            {connectionError ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
              >
                اتصال پایدار نیست؛ تلاش مجدد به‌صورت خودکار انجام می‌شود.
              </p>
            ) : null}
            {status !== "ready" ? (
              <button
                type="button"
                onClick={editProfile}
                className="mt-4 min-h-11 rounded-xl border border-[color:var(--live-border)] px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                ویرایش نام و آواتار
              </button>
            ) : null}
          </Motion.div>
        </section>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell quiz={quiz}>
      <section className="flex flex-1 items-center justify-center py-5">
        <form
          onSubmit={handleSubmit}
          className="w-full rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-5 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          <div className="mb-7 text-center">
            <p className="text-sm text-[color:var(--live-muted)]">
              ورود شرکت‌کننده
            </p>
            <h1 className="mt-2 text-3xl font-black">به کوئیز بپیوندید</h1>
          </div>

          <label htmlFor="participant-name" className="mb-2 block text-sm font-bold">
            نام نمایشی
          </label>
          <input
            id="participant-name"
            autoComplete="nickname"
            autoFocus
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="مثلاً سارا"
            aria-invalid={Boolean(validation)}
            aria-describedby={validation ? "participant-name-error" : undefined}
            className="min-h-14 w-full rounded-2xl border border-[color:var(--live-border)] bg-white/95 px-4 text-center text-lg font-bold text-slate-950 outline-none placeholder:text-slate-500 focus-visible:ring-4 focus-visible:ring-white/30"
          />
          {validation ? (
            <p id="participant-name-error" role="alert" className="mt-2 text-sm font-medium">
              {validation}
            </p>
          ) : null}

          <fieldset className="mt-7">
            <legend className="text-sm font-bold">آواتار شما</legend>
            <button
              type="button"
              onClick={() => setShowPicker((value) => !value)}
              aria-expanded={showPicker}
              aria-controls="participant-avatar-picker"
              className="mt-3 flex min-h-24 w-full items-center justify-center gap-4 rounded-2xl border border-[color:var(--live-border)] bg-white/10 px-4 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
            >
              <Motion.span
                key={avatar}
                initial={{ scale: 0.7, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                className="text-6xl"
                aria-hidden="true"
              >
                {avatar}
              </Motion.span>
              <span className="text-sm font-bold">برای تغییر آواتار بزنید</span>
            </button>

            <AnimatePresence>
              {showPicker ? (
                <Motion.div
                  id="participant-avatar-picker"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden rounded-2xl"
                  dir="ltr"
                >
                  <EmojiPicker
                    onEmojiClick={({ emoji }) => {
                      setAvatar(emoji);
                      setShowPicker(false);
                    }}
                    theme="dark"
                    width="100%"
                    height={320}
                    searchPlaceholder="جست‌وجوی ایموجی"
                    previewConfig={{ showPreview: false }}
                  />
                </Motion.div>
              ) : null}
            </AnimatePresence>
          </fieldset>

          <button
            type="submit"
            className="mt-7 min-h-14 w-full rounded-2xl bg-white px-6 text-lg font-black text-slate-950 shadow-xl transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
          >
            ورود به کوئیز
          </button>
          <p className="mt-4 text-center text-xs leading-6 text-[color:var(--live-muted)]">
            هویت و پاسخ‌های این جلسه فقط برای بازیابی همین اتاق نگهداری می‌شوند.
          </p>
        </form>
      </section>
    </ParticipantShell>
  );
}
