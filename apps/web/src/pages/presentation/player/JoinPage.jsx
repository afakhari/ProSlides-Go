import { useEffect, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { useLiveSession } from "../../../hooks/useLiveSession";
import { ParticipantShell } from "../../../modules/live/participant/ParticipantShell";
import { createClientUserId, DEFAULT_AVATAR, getPersistedUserIdForRoom, readStoredProfile, saveStoredProfile } from "./playerProfileStorage";

export default function PlayerJoinPage({ roomId, quiz }) {
  const restored = readStoredProfile(roomId);
  const [name, setName] = useState(restored?.name || "");
  const [avatar, setAvatar] = useState(restored?.avatar || DEFAULT_AVATAR);
  const [joined, setJoined] = useState(Boolean(restored));
  const [joinSent, setJoinSent] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [validation, setValidation] = useState("");
  const [attempt, setAttempt] = useState(0);
  const { connect, joinParticipant, isConnected, lastJoinResult, connectionError } = useLiveSession();

  useEffect(() => {
    if (!joined || !roomId || isConnected) return;
    let cancelled = false;
    let retryTimer;
    void connect(roomId).then((ok) => {
      if (!cancelled && !ok) retryTimer = setTimeout(() => setAttempt((value) => value + 1), Math.min(1000 * 2 ** attempt, 10_000));
    });
    return () => { cancelled = true; clearTimeout(retryTimer); };
  }, [joined, roomId, isConnected, connect, attempt]);

  useEffect(() => {
    if (!joined || !isConnected || joinSent) return;
    let cancelled = false;
    void joinParticipant({ name, avatar, clientUserId: getPersistedUserIdForRoom(roomId) }).then((ok) => { if (!cancelled && ok === true) setJoinSent(true); });
    return () => { cancelled = true; };
  }, [joined, isConnected, joinSent, name, avatar, joinParticipant, roomId]);

  useEffect(() => {
    if (!lastJoinResult) return;
    saveStoredProfile({ room_id: roomId, name: lastJoinResult.displayName || name, avatar: lastJoinResult.avatar || avatar, user_id: lastJoinResult.clientUserId });
  }, [lastJoinResult, roomId, name, avatar]);

  const savePlayer = (event) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) return setValidation("نام شما باید حداقل دو نویسه داشته باشد.");
    const userId = getPersistedUserIdForRoom(roomId) || createClientUserId();
    saveStoredProfile({ room_id: roomId, name: cleanName, avatar, user_id: userId });
    setName(cleanName); setValidation(""); setJoined(true); setJoinSent(false);
  };

  if (joined) return (
    <ParticipantShell quiz={quiz} connected={isConnected} showConnection>
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <Motion.div initial={{ scale: .88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-6 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-3xl border border-[color:var(--live-border)] bg-white/10 text-6xl shadow-xl" aria-hidden="true">{avatar}</div>
          <p className="text-sm text-[color:var(--live-muted)]">خوش آمدید</p>
          <h1 className="mt-1 text-3xl font-black" dir="auto">{name}</h1>
          <div className="mx-auto my-6 h-px w-20 bg-[color:var(--live-border)]" />
          <p className="text-xl font-bold">برای شروع کوئیز آماده باشید</p>
          <p className="mt-2 text-sm leading-7 text-[color:var(--live-muted)]">به‌محض شروع سؤال، گزینه‌ها همین‌جا نمایش داده می‌شوند.</p>
          {connectionError && <p role="alert" className="mt-5 rounded-xl border border-amber-300/30 bg-amber-950/25 px-4 py-3 text-sm">اتصال برقرار نشد؛ تلاش دوباره به‌صورت خودکار انجام می‌شود.</p>}
          {!joinSent && connectionError && <button type="button" onClick={() => setJoined(false)} className="mt-4 min-h-11 rounded-xl border border-[color:var(--live-border)] px-5 text-sm font-bold">ویرایش نام و آواتار</button>}
        </Motion.div>
      </section>
    </ParticipantShell>
  );

  return (
    <ParticipantShell quiz={quiz}>
      <section className="flex flex-1 items-center justify-center py-5">
        <form onSubmit={savePlayer} className="w-full rounded-[2rem] border border-[color:var(--live-border)] bg-[color:var(--live-surface)] p-5 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-7 text-center"><p className="text-sm text-[color:var(--live-muted)]">ورود شرکت‌کننده</p><h1 className="mt-2 text-3xl font-black">به کوئیز بپیوندید</h1></div>
          <label htmlFor="participant-name" className="mb-2 block text-sm font-bold">نام نمایشی</label>
          <input id="participant-name" autoComplete="nickname" autoFocus maxLength={40} value={name} onChange={(event) => { setName(event.target.value); setValidation(""); }} placeholder="مثلاً سارا" aria-invalid={Boolean(validation)} aria-describedby={validation ? "participant-name-error" : undefined} className="min-h-14 w-full rounded-2xl border border-[color:var(--live-border)] bg-white/95 px-4 text-center text-lg font-bold text-slate-950 outline-none placeholder:text-slate-500 focus-visible:ring-4 focus-visible:ring-white/30" />
          {validation && <p id="participant-name-error" role="alert" className="mt-2 text-sm font-medium">{validation}</p>}
          <fieldset className="mt-7"><legend className="text-sm font-bold">آواتار شما</legend>
            <button type="button" onClick={() => setShowPicker((value) => !value)} aria-expanded={showPicker} className="mt-3 flex min-h-24 w-full items-center justify-center gap-4 rounded-2xl border border-[color:var(--live-border)] bg-white/10 px-4 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"><Motion.span key={avatar} initial={{ scale: .7, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} className="text-6xl" aria-hidden="true">{avatar}</Motion.span><span className="text-sm font-bold">برای تغییر آواتار بزنید</span></button>
            <AnimatePresence>{showPicker && <Motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 overflow-hidden rounded-2xl" dir="ltr"><EmojiPicker onEmojiClick={({ emoji }) => { setAvatar(emoji); setShowPicker(false); }} theme="dark" width="100%" height={320} searchPlaceholder="جست‌وجوی ایموجی" previewConfig={{ showPreview: false }} /></Motion.div>}</AnimatePresence>
          </fieldset>
          <button type="submit" className="mt-7 min-h-14 w-full rounded-2xl bg-white px-6 text-lg font-black text-slate-950 shadow-xl transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40">ورود به کوئیز</button>
          <p className="mt-4 text-center text-xs leading-6 text-[color:var(--live-muted)]">پاسخ‌ها پس از ثبت، به‌صورت امن برای همین جلسه نگهداری می‌شوند.</p>
        </form>
      </section>
    </ParticipantShell>
  );
}
