import { AnimatePresence, motion as Motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { formatPersianNumber } from "../../../../shared/forms/numbers.ts";
import { presentationTheme } from "../../../../shared/styles/presentationTheme.ts";
import { getColorForUser } from "../../../../lib/colorUtils";
import type { EditorSlide } from "../../model/editor.ts";
import { useOptionalDesignDraft } from "../model/useDesignDraftContext.ts";

type LeaderboardInput = {
  rust_session_id?: string;
  player_name?: string;
  avatar?: string;
  rank?: number;
  score?: number;
};

type LeaderboardSlide = EditorSlide & {
  leaderboard?: LeaderboardInput[];
  leaderboard_title?: string;
};

type LeaderboardCanvasProps = {
  slide: LeaderboardSlide;
  quizBackground?: string;
  quizBackgroundImage?: string;
  textColor?: string;
  isFullSize?: boolean;
  customLeaderboard?: LeaderboardInput[] | null;
};

type PreviewPlayer = {
  userId: string;
  name: string;
  character: string;
  color: string;
  rank: number;
  totalPoints: number;
};

export default function LeaderboardPreview({
  slide,
  quizBackground,
  quizBackgroundImage,
  textColor = "#111827",
  isFullSize = true,
  customLeaderboard = null,
}: LeaderboardCanvasProps) {
  const [animateBars, setAnimateBars] = useState(false);
  const designController = useOptionalDesignDraft();

  const players = useMemo<PreviewPlayer[]>(() => {
    const sourceData = customLeaderboard ?? slide?.leaderboard ?? [];

    return [...sourceData]
      .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0))
      .slice(0, 5)
      .map((player, index) => {
        const userId = String(
          player.rust_session_id || `player-${index}`,
        );
        return {
          userId,
          name:
            player.player_name ||
            `بازیکن ${formatPersianNumber(index + 1)}`,
          character: player.avatar || "🙂",
          color: getColorForUser(userId),
          rank: Number(player.rank || index + 1),
          totalPoints: Number(player.score || 0),
        };
      });
  }, [customLeaderboard, slide?.leaderboard]);

  const maxScore = Math.max(
    ...players.map((player) => player.totalPoints),
    0,
  );

  const calcPercent = (score: number) => {
    if (maxScore <= 0) return 100;
    return Math.max((score / maxScore) * 99 + 1, 1);
  };

  useEffect(() => {
    setAnimateBars(false);
    const timeout = window.setTimeout(() => {
      setAnimateBars(true);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [players]);

  const theme = useMemo(
    () =>
      presentationTheme({
        background: {
          color:
            designController?.draft.backgroundColor ??
            quizBackground,
          image:
            designController?.draft.backgroundImageUrl ??
            quizBackgroundImage,
          text_color:
            designController?.draft.textColor ??
            textColor,
        },
        text_color:
          designController?.draft.textColor ??
          textColor,
      }),
    [
      designController?.draft.backgroundColor,
      designController?.draft.backgroundImageUrl,
      designController?.draft.textColor,
      quizBackground,
      quizBackgroundImage,
      textColor,
    ],
  );

  const containerClasses = isFullSize
    ? "aspect-[3/2] h-auto max-h-[82%] w-full max-w-[88%]"
    : "aspect-[3/2] h-auto max-h-[95%] w-full max-w-[96%]";
  const titleSize = isFullSize ? "text-4xl" : "text-2xl";
  const rowHeight = isFullSize ? "h-14" : "h-11";
  const avatarSize = isFullSize ? "text-2xl" : "text-lg";
  const rankSize = isFullSize
    ? "size-10 text-lg"
    : "size-8 text-base";
  const nameSize = isFullSize ? "text-base" : "text-sm";
  const scoreSize = isFullSize ? "text-base" : "text-sm";

  return (
    <section
      aria-label="پیش‌نمایش جدول امتیازات"
      dir="rtl"
      className={`relative flex flex-col items-center overflow-hidden rounded-[1.75rem] border border-[color:var(--live-border)] bg-cover bg-center font-sans text-[color:var(--live-fg)] shadow-2xl ${containerClasses}`}
      style={theme.style}
    >
      <div className="flex h-full w-full flex-col overflow-y-auto px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-[color:var(--live-border)] bg-black/25 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
            پیش‌نمایش شرکت‌کننده
          </span>
          {designController?.dirty && (
            <span className="rounded-full border border-warning-border bg-warning-soft px-3 py-1.5 text-xs font-bold text-warning-ink">
              طراحی ذخیره‌نشده
            </span>
          )}
        </div>

        <header className="mb-6 mt-5 w-full text-center">
          <h2 className={`${titleSize} font-black`}>
            {slide?.leaderboard_title || "جدول امتیازات"}
          </h2>
          <p className="mt-2 text-sm font-bold text-[color:var(--live-muted)]">
            {formatPersianNumber(players.length)} بازیکن
          </p>
        </header>

        <div className="mx-auto w-full max-w-3xl flex-1">
          {players.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--live-border)] bg-black/20 px-5 py-8 text-center text-sm font-bold text-[color:var(--live-muted)]">
              هنوز نتیجه‌ای نیست
            </div>
          ) : (
            <ol className="flex w-full flex-col items-stretch gap-4 py-2">
              <AnimatePresence>
                {players.map((player) => {
                  const hasScore = player.totalPoints > 0;
                  const widthPercent = hasScore
                    ? calcPercent(player.totalPoints)
                    : 0;

                  return (
                    <Motion.li
                      key={player.userId}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{
                        type: "spring",
                        stiffness: 120,
                        damping: 18,
                      }}
                      className="relative flex w-full items-center"
                      aria-label={`رتبه ${formatPersianNumber(player.rank)}، ${player.name}، ${formatPersianNumber(Math.round(player.totalPoints))} امتیاز`}
                    >
                      <div
                        className={`${rankSize} ms-3 grid shrink-0 place-items-center rounded-full font-black text-white`}
                        style={{
                          backgroundColor: player.color,
                          boxShadow: `0 4px 12px ${player.color}60`,
                        }}
                        aria-hidden="true"
                      >
                        {formatPersianNumber(player.rank)}
                      </div>

                      <div
                        className={`relative ms-3 flex-1 overflow-hidden rounded-xl border border-[color:var(--live-border)] bg-white/10 ${rowHeight}`}
                      >
                        {hasScore && (
                          <Motion.div
                            className="absolute inset-y-0 start-0 z-10 rounded-xl"
                            style={{
                              backgroundColor: player.color,
                              boxShadow: `0 4px 15px ${player.color}80, 0 2px 8px ${player.color}60`,
                            }}
                            initial={{ width: 0 }}
                            animate={{
                              width: animateBars
                                ? `${widthPercent}%`
                                : 0,
                            }}
                            transition={{
                              duration: 1.3,
                              ease: "easeOut",
                            }}
                          />
                        )}

                        <div className="relative z-20 flex h-full items-center gap-4 px-4">
                          <span
                            className={`${avatarSize} shrink-0`}
                            aria-hidden="true"
                          >
                            {player.character}
                          </span>
                          <span
                            className={`truncate font-bold ${nameSize}`}
                          >
                            {player.name}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-16 shrink-0 text-end font-black ${scoreSize}`}
                      >
                        {formatPersianNumber(
                          Math.round(player.totalPoints),
                        )}
                      </div>
                    </Motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
