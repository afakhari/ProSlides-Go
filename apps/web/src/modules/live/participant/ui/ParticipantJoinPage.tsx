import { lazy, Suspense, useState, type FormEvent } from "react";

import type { LivePresentationModel } from "../../model/presentation.ts";
import { ParticipantShell } from "../ParticipantShell.tsx";
import { useParticipantJoinController } from "../useParticipantJoinController.ts";

const ParticipantAvatarPicker = lazy(async () => {
  const module = await import("./ParticipantAvatarPicker.tsx");
  return { default: module.ParticipantAvatarPicker };
});

type ParticipantJoinPageProps = {
  roomId?: string;
  quiz: LivePresentationModel;
};

export function ParticipantJoinPage({
  roomId,
  quiz,
}: ParticipantJoinPageProps) {
  const controller = useParticipantJoinController(roomId);
  const [showPicker, setShowPicker] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    controller.submitProfile();
  };

  if (!controller.isEditing) {
    return (
      <ParticipantShell
        quiz={quiz}
        connected={controller.isStreamConnected}
        showConnection={!controller.isJoining}
      >
        <section className="flex flex-1 flex-col items-center justify-center py-5 text-center">
          <div className="w-full rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-6 shadow-2xl backdrop-blur-xl sm:p-10">
            <div
              className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-3xl border border-[color:var(--live-border)] bg-white/10 text-6xl shadow-xl"
              aria-hidden="true"
            >
              {controller.avatar}
            </div>
            <p className="text-sm text-[color:var(--live-muted)]">خوش آمدید</p>
            <h1 className="mt-1 text-3xl font-black" dir="auto">
              {controller.name}
            </h1>
            <div className="mx-auto my-6 h-px w-20 bg-[color:var(--live-border)]" />
            <p className="text-xl font-bold">
              {controller.isJoining
                ? "در حال ورود به جلسه…"
                : "برای شروع کوئیز آماده باشید"}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--live-muted)]">
              به‌محض شروع سؤال یا اسلاید بعدی، همین صفحه به‌صورت خودکار به‌روز
              می‌شود.
            </p>

            {controller.connectionError ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-amber-300/30 bg-amber-950/25 px-4 py-3 text-sm"
              >
                اتصال برقرار نشد؛ تلاش مجدد با فاصلهٔ افزایشی انجام می‌شود.
              </p>
            ) : null}

            {controller.joinError ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-rose-300/30 bg-rose-950/25 px-4 py-3 text-sm"
              >
                {controller.joinError}
              </p>
            ) : null}

            {controller.connectionError || controller.joinError ? (
              <button
                type="button"
                onClick={controller.editProfile}
                className="mt-4 min-h-11 rounded-xl border border-[color:var(--live-border)] bg-white/5 px-5 text-sm font-bold hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
              >
                ویرایش نام و آواتار
              </button>
            ) : null}
          </div>
        </section>
      </ParticipantShell>
    );
  }

  return (
    <ParticipantShell quiz={quiz}>
      <section className="flex flex-1 items-center justify-center py-5">
        <form
          onSubmit={submit}
          className="w-full rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-5 shadow-2xl backdrop-blur-xl sm:p-8"
        >
          <div className="mb-7 text-center">
            <p className="text-sm text-[color:var(--live-muted)]">
              ورود شرکت‌کننده
            </p>
            <h1 className="mt-2 text-3xl font-black">به کوئیز بپیوندید</h1>
          </div>

          <label
            htmlFor="participant-name"
            className="mb-2 block text-sm font-bold"
          >
            نام نمایشی
          </label>
          <input
            id="participant-name"
            autoComplete="nickname"
            autoFocus
            maxLength={100}
            value={controller.name}
            onChange={(event) => controller.setName(event.target.value)}
            placeholder="مثلاً سارا"
            aria-invalid={Boolean(controller.validation)}
            aria-describedby={
              controller.validation ? "participant-name-error" : undefined
            }
            className="min-h-14 w-full rounded-2xl border border-[color:var(--live-border)] bg-white/95 px-4 text-center text-lg font-bold text-slate-950 outline-none placeholder:text-slate-500 focus-visible:ring-4 focus-visible:ring-white/30"
          />
          {controller.validation ? (
            <p
              id="participant-name-error"
              role="alert"
              className="mt-2 text-sm font-medium"
            >
              {controller.validation}
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
              <span className="text-6xl" aria-hidden="true">
                {controller.avatar}
              </span>
              <span className="text-sm font-bold">
                برای تغییر آواتار بزنید
              </span>
            </button>
            {showPicker ? (
              <div
                id="participant-avatar-picker"
                className="mt-3 overflow-hidden rounded-2xl"
                dir="ltr"
              >
                <Suspense
                  fallback={
                    <div
                      className="grid h-80 place-items-center bg-slate-950 text-sm text-white/70"
                      role="status"
                    >
                      در حال آماده‌سازی انتخاب آواتار…
                    </div>
                  }
                >
                  <ParticipantAvatarPicker
                    onSelect={(emoji) => {
                      controller.setAvatar(emoji);
                      setShowPicker(false);
                    }}
                  />
                </Suspense>
              </div>
            ) : null}
          </fieldset>

          {controller.joinError ? (
            <p role="alert" className="mt-4 text-sm font-medium">
              {controller.joinError}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-7 min-h-14 w-full rounded-2xl bg-white px-6 text-lg font-black text-slate-950 shadow-xl transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 motion-reduce:transform-none"
          >
            ورود به کوئیز
          </button>
          <p className="mt-4 text-center text-xs leading-6 text-[color:var(--live-muted)]">
            پاسخ‌ها فقط برای همین جلسه ثبت می‌شوند.
          </p>
        </form>
      </section>
    </ParticipantShell>
  );
}
