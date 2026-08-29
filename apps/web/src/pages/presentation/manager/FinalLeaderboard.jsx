import { useMemo } from "react";
import { motion as Motion } from "framer-motion";
import { useLiveSession } from "../../../hooks/useLiveSession";
import { participantTheme } from "../../../modules/live/participant/theme";

const podiumStyle = {
  1: { order: "md:order-2", height: "h-56 md:h-72", color: "from-amber-300 to-yellow-500", icon: "👑" },
  2: { order: "md:order-1", height: "h-44 md:h-56", color: "from-slate-200 to-slate-400", icon: "🥈" },
  3: { order: "md:order-3", height: "h-36 md:h-44", color: "from-orange-300 to-amber-600", icon: "🥉" },
};

export default function FinalLeaderboard({ leaderboardData, quiz, onExit }) {
  const { isConnected } = useLiveSession();
  const players = useMemo(() => [...(leaderboardData?.results || leaderboardData || [])].sort((a, b) => (b.total_points || 0) - (a.total_points || 0)).slice(0, 3), [leaderboardData]);
  const theme = participantTheme(quiz);

  return (
    <div dir="rtl" className="fixed inset-0 z-50 flex flex-col overflow-auto bg-cover bg-center px-4 py-6 text-[color:var(--live-fg)]" style={theme.style}>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <p className="font-outfit text-xl font-black" dir="ltr">ProSlides</p>
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs backdrop-blur" role="status"><span className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-300"}`} />{isConnected ? "متصل" : "در حال اتصال"}</div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center py-7 text-center">
        <Motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-bold text-white/70">پایان کوئیز</Motion.p>
        <Motion.h1 initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-4xl font-black md:text-6xl">برترین‌های این رقابت</Motion.h1>
        {players.length ? <div className="mt-10 flex w-full flex-col items-stretch justify-center gap-4 md:flex-row md:items-end">{players.map((player, index) => <Podium key={player.user_id || index} player={player} rank={index + 1} />)}</div> : <div className="mt-10 rounded-3xl border border-white/15 bg-black/20 px-8 py-10 text-white/75 backdrop-blur">هنوز امتیازی برای نمایش وجود ندارد.</div>}
        <button onClick={onExit} className="mt-9 min-h-12 rounded-2xl bg-white px-7 font-black text-slate-950 shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40">بازگشت به پنل مدیریت</button>
      </main>
    </div>
  );
}

function Podium({ player, rank }) {
  const style = podiumStyle[rank];
  return <Motion.article initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * .18 }} className={`flex flex-1 flex-col items-center ${style.order}`}>
    <div className="relative z-10 -mb-6 grid h-24 w-24 place-items-center rounded-full border-4 border-white/70 bg-slate-900 text-5xl shadow-2xl"><span className="absolute -top-7 text-4xl">{style.icon}</span>{player.character || "👤"}</div>
    <div className={`flex w-full max-w-xs flex-col justify-between rounded-t-3xl bg-gradient-to-b ${style.color} ${style.height} px-4 pb-5 pt-10 text-slate-950 shadow-2xl`}>
      <div><h2 className="truncate text-xl font-black" dir="auto">{player.name}</h2><p className="mt-1 font-bold">{Math.round(player.total_points || 0).toLocaleString("fa-IR")} امتیاز</p></div><p className="text-5xl font-black opacity-30">{rank.toLocaleString("fa-IR")}</p>
    </div>
  </Motion.article>;
}
