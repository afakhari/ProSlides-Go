import { useState, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";
import { motion as Motion } from "framer-motion";
import { useLiveSession } from "../../../hooks/useLiveSession";
import { isLightColor } from "../../../lib/colorUtils";
import {
  createClientUserId,
  DEFAULT_AVATAR,
  getPersistedUserIdForRoom,
  readStoredProfile,
  saveStoredProfile,
} from "./playerProfileStorage";

const getEmojiAnimation = (emoji) => {
  const robots = ["🤖", "👾", "🛸"];
  const ghosts = ["👻", "🧙", "🧛", "🧚", "🧞"];
  const animals = ["🐱", "🐶", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷"];
  const food = ["🍕", "🍔", "🎂", "🍰", "🍩", "🍪", "🍦", "🍓", "🍌", "🍎"];
  const celebration = ["🎉", "🎊", "⭐", "✨", "💫", "🌟", "🎈", "🎁"];
  const faces = ["😊", "😂", "🥰", "😎", "🤩", "😍", "🤗", "😇"];
  const royal = ["👑", "💎", "🏆", "🥇", "🎖️", "💍"];
  const hearts = ["❤️", "💕", "💖", "💗", "💓", "💝"];

  if (robots.includes(emoji)) {
    return {
      initial: { rotate: 0, scale: 1 },
      animate: {
        rotate: [0, -10, 10, -10, 10, 0],
        scale: [1, 1.2, 1],
        filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"],
      },
      transition: { duration: 0.6, ease: "easeInOut" },
    };
  }

  if (ghosts.includes(emoji)) {
    return {
      initial: { y: 0, opacity: 1 },
      animate: {
        y: [-10, -20, -10, 0],
        opacity: [1, 0.7, 1],
      },
      transition: { duration: 0.8, ease: "easeInOut" },
    };
  }

  if (animals.includes(emoji)) {
    return {
      initial: { y: 0, rotate: 0 },
      animate: {
        y: [0, -30, -10, 0],
        rotate: [0, -5, 5, 0],
      },
      transition: { duration: 0.5, ease: "easeOut" },
    };
  }

  if (food.includes(emoji)) {
    return {
      initial: { scale: 1, rotate: 0 },
      animate: {
        scale: [1, 1.3, 1.1, 1],
        rotate: [0, 360],
      },
      transition: { duration: 0.7, ease: "easeInOut" },
    };
  }

  if (celebration.includes(emoji)) {
    return {
      initial: { scale: 1, rotate: 0, filter: "brightness(1)" },
      animate: {
        scale: [1, 1.3, 1.2, 1],
        rotate: [0, 180, 360],
        filter: [
          "brightness(1)",
          "brightness(2)",
          "brightness(1.5)",
          "brightness(1)",
        ],
      },
      transition: { duration: 0.8, ease: "easeInOut" },
    };
  }

  if (faces.includes(emoji)) {
    return {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.4, 0.9, 1.2, 1],
      },
      transition: { duration: 0.6, type: "spring", bounce: 0.5 },
    };
  }

  if (royal.includes(emoji)) {
    return {
      initial: { scale: 1, rotate: 0, y: 0 },
      animate: {
        scale: [1, 1.2, 1.1, 1],
        rotate: [-10, 10, -10, 10, 0],
        y: [0, -5, 0],
        filter: [
          "brightness(1)",
          "brightness(1.8) drop-shadow(0 0 10px gold)",
          "brightness(1)",
        ],
      },
      transition: { duration: 0.9, ease: "easeInOut" },
    };
  }

  if (hearts.includes(emoji)) {
    return {
      initial: { scale: 1 },
      animate: {
        scale: [1, 1.5, 1.3, 1.5, 1],
      },
      transition: { duration: 0.7, ease: "easeInOut" },
    };
  }

  return {
    initial: { scale: 1, rotate: 0 },
    animate: {
      scale: [1, 1.3, 1],
      rotate: [0, 10, -10, 0],
    },
    transition: { duration: 0.5, ease: "easeInOut" },
  };
};

export default function PlayerJoinPage({ roomId, quiz }) {
  const restoredProfile = readStoredProfile(roomId);
  const [name, setName] = useState(restoredProfile?.name || "");
  const [avatar, setAvatar] = useState(restoredProfile?.avatar || DEFAULT_AVATAR);
  const [showPicker, setShowPicker] = useState(false);
  const [joined, setJoined] = useState(Boolean(restoredProfile));
  const [joinSent, setJoinSent] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectAttempt, setConnectAttempt] = useState(0);

  const { connect, joinParticipant, isConnected, lastJoinResult, connectionError } =
    useLiveSession();


  useEffect(() => {
    const profile = readStoredProfile(roomId);
    if (!profile) {
      setJoined(false);
      setJoinSent(false);
      return;
    }

    setName(profile.name);
    setAvatar(profile.avatar);
    setJoined(true);
  }, [roomId]);


  useEffect(() => {
    if (isConnected) {
      setIsConnecting(false);
      return;
    }
    if (connectionError) {
      setIsConnecting(false);
    }
  }, [isConnected, connectionError]);

  useEffect(() => {
    if (!joined) return;
    if (!roomId) return;
    if (isConnected) return;

    let cancelled = false;
    let retryTimer;
    setIsConnecting(true);
    void connect(roomId).then((ok) => {
      if (cancelled || ok) return;
      const retryDelay = Math.min(1000 * 2 ** connectAttempt, 10_000);
      retryTimer = setTimeout(() => setConnectAttempt((attempt) => attempt + 1), retryDelay);
    });
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [joined, roomId, isConnected, connect, connectAttempt]);

  const savePlayer = () => {
    if (!name.trim()) {
      return alert("لطفاً نام خود را وارد کنید!");
    }

    const stableUserId = getPersistedUserIdForRoom(roomId) || createClientUserId();
    saveStoredProfile({ room_id: roomId, name, avatar, user_id: stableUserId });
    setJoined(true);
    setJoinSent(false);
  };

  const handleEditBeforeJoin = () => {
    setJoined(false);
    setJoinSent(false);
  };

  useEffect(() => {
    if (!joined) return;
    if (!isConnected) return;
    if (joinSent) return;

    const command = {
      name,
      avatar,
      clientUserId: getPersistedUserIdForRoom(roomId),
    };

    let cancelled = false;
    void joinParticipant(command).then((outcome) => {
      if (!cancelled && outcome === true) setJoinSent(true);
    });
    return () => {
      cancelled = true;
    };
  }, [joined, isConnected, joinSent, name, avatar, joinParticipant, roomId]);

  useEffect(() => {
    if (!joined) return;
    if (isConnected) return;
    setJoinSent(false);
  }, [joined, isConnected]);

  useEffect(() => {
    if (!lastJoinResult) return;
    saveStoredProfile({
      room_id: roomId,
      name: lastJoinResult.displayName || name,
      avatar: lastJoinResult.avatar || avatar,
      user_id: lastJoinResult.clientUserId,
    });
  }, [lastJoinResult, roomId, name, avatar]);

  const backgroundStyle = {
    backgroundImage: quiz?.background?.image
      ? `url('${quiz.background.image}')`
      : "none",
    backgroundColor: quiz?.background?.color || "#1e1e2e",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };

  const textColor = quiz?.text_color || quiz?.background?.text_color || "#111827";
  const textMutedColor =
    textColor.toLowerCase() === "#111827"
      ? "rgba(17, 24, 39, 0.7)"
      : "rgba(255, 255, 255, 0.7)";
  const needsOverlay =
    !!quiz?.background?.image ||
    isLightColor(quiz?.background?.color || "#1e1e2e");

  const currentPlayer = {
    name: name || localStorage.getItem("player_name") || "",
    avatar: avatar || localStorage.getItem("character") || DEFAULT_AVATAR,
  };

  return !joined ? (
    <div
      className="relative min-h-screen w-full"
      style={{
        ...backgroundStyle,
        "--quiz-text": textColor,
        "--quiz-text-muted": textMutedColor,
      }}
    >
      {needsOverlay && (
        <div className="pointer-events-none absolute inset-0 bg-black/45" />
      )}
      <div className="relative z-10">
        <div className="flex flex-col items-center justify-center">
          <header>
            <div className="flex items-center justify-center text-[color:var(--quiz-text)] px-6 py-7 rounded-t-xl placeholder-gray-500">
              <div className="shrink-0">
                <p className="text-3xl">Proslides</p>
              </div>
            </div>
          </header>

          {connectionError && (
            <div className="mt-2 rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">
              خطای اتصال. لطفاً دوباره تلاش کنید.
            </div>
          )}

          <div className="flex flex-col items-center mt-7 justify-around w-4/5 max-w-2xl text-[color:var(--quiz-text)]">
            <div className="w-full">
              <h1 className="text-right text-2xl font-extrabold">نام خود را وارد کنید</h1>
            </div>
            <input
              className="bg-white px-4 py-2 w-full rounded text-center text-lg font-bold placeholder-gray-400 text-gray-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="mt-12 w-full">
              <h1 className="text-right text-2xl font-extrabold">یک آواتار انتخاب کنید</h1>
            </div>

            <div className="flex flex-col items-center relative">
              <Motion.div
                key={avatar}
                className="text-9xl mb-2 cursor-pointer select-none"
                onClick={() => {
                  setIsAnimating(true);
                  setTimeout(() => setIsAnimating(false), 1000);
                }}
                {...getEmojiAnimation(avatar)}
                animate={
                  isAnimating
                    ? getEmojiAnimation(avatar).animate
                    : getEmojiAnimation(avatar).initial
                }
              >
                {avatar}
              </Motion.div>

              <button
                onClick={() => setShowPicker(!showPicker)}
                className="font-medium underline hover:text-purple-900 text-2xl"
              >
                تغییر آواتار
              </button>

              {showPicker && (
                <div className="absolute mt-4 z-10">
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      setAvatar(emojiData.emoji);
                      setShowPicker(false);
                    }}
                    theme="light"
                    searchDisabled={false}
                    width={300}
                    height={400}
                  />
                </div>
              )}
            </div>

            <button
              onClick={savePlayer}
              className="mt-12 bg-purple-700 w-full text-white px-10 py-3 rounded-lg hover:bg-purple-800 transition disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isConnecting}
            >
              {isConnecting ? "در حال اتصال..." : "ورود به بازی"}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div
      className="relative min-h-screen w-full"
      style={{
        ...backgroundStyle,
        "--quiz-text": textColor,
        "--quiz-text-muted": textMutedColor,
      }}
    >
      {needsOverlay && (
        <div className="pointer-events-none absolute inset-0 bg-black/45" />
      )}
      <div className="relative z-10">
        <header>
          <div className="flex items-center justify-center text-[color:var(--quiz-text)] px-6 py-7 rounded-t-xl">
            <div className="shrink-0">
              <p className="text-3xl">Proslides</p>
            </div>
          </div>
        </header>

        {connectionError && (
          <div className="mt-2 flex justify-center">
            <div className="rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">
              خطای اتصال. لطفاً دوباره تلاش کنید.
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center h-full">
          <div className="flex items-center space-x-4 px-6 py-3 rounded-2xl m-4 text-[color:var(--quiz-text)]">
            <Motion.span
              className="text-5xl cursor-pointer select-none"
              onClick={() => {
                setIsAnimating(true);
                setTimeout(() => setIsAnimating(false), 1000);
              }}
              {...getEmojiAnimation(currentPlayer.avatar)}
              animate={
                isAnimating
                  ? getEmojiAnimation(currentPlayer.avatar).animate
                  : getEmojiAnimation(currentPlayer.avatar).initial
              }
            >
              {currentPlayer.avatar}
            </Motion.span>
            <span className="text-2xl font-semibold">{currentPlayer.name}</span>
          </div>

          <h4 className="text-3xl text-center mb-6 m-8 text-[color:var(--quiz-text)]">
            آماده بازی شوید!
          </h4>

          <h3 className="mb-6 text-[color:var(--quiz-text-muted)]">
            آزمون به‌زودی شروع می‌شود.
          </h3>

          {!joinSent && connectionError && (
            <button
              onClick={handleEditBeforeJoin}
              className="mt-2 rounded-lg border border-white/30 bg-black/25 px-4 py-2 text-sm text-[color:var(--quiz-text)] hover:bg-black/40"
            >
              ویرایش نام یا آواتار
            </button>
          )}

        </div>

      </div>
    </div>
  );
}
