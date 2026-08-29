
import React, { useEffect, useState } from "react";
import {
  FOOTER_CHAT_MESSAGES,
  FOOTER_MENU_ITEMS,
  FOOTER_REACTIONS,
} from "../modules/live/model/runtimeDefaults";
import ReactionEffects from "./ReactionEffects";

export default function Footer({
  currentSlide = 1,
  totalSlides = null,
  onQRToggle = null,
  isQROpen = false,
  onShowLeaderboard = null,
  onNext = null,
  endOnLastSlide = true,
  onEnd = null,
  textColor = "#ffffff",
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [chatMessages] = useState(FOOTER_CHAT_MESSAGES);
  const [activeEffect, setActiveEffect] = useState(null);
  const [reactionCloseTimer, setReactionCloseTimer] = useState(null);

  const menuItems = FOOTER_MENU_ITEMS;
  const reactions = FOOTER_REACTIONS;

  const qrOpen = onQRToggle ? isQROpen : false;
  const labels = {
    controls: "\u06a9\u0646\u062a\u0631\u0644 \u0627\u0633\u0644\u0627\u06cc\u062f\u0647\u0627",
    previous: "\u0627\u0633\u0644\u0627\u06cc\u062f \u0642\u0628\u0644\u06cc",
    previousShort: "\u0642\u0628\u0644\u06cc",
    slide: "\u0627\u0633\u0644\u0627\u06cc\u062f",
    end: "\u067e\u0627\u06cc\u0627\u0646",
    next: "\u0627\u0633\u0644\u0627\u06cc\u062f \u0628\u0639\u062f\u06cc",
    nextShort: "\u0628\u0639\u062f\u06cc",
    effects: "\u0627\u0641\u06a9\u062a\u200c\u0647\u0627",
    leaderboard: "\u062c\u062f\u0648\u0644 \u0627\u0645\u062a\u06cc\u0627\u0632\u0627\u062a",
    endPresentation: "\u067e\u0627\u06cc\u0627\u0646 \u067e\u0631\u0632\u0646\u062a\u06cc\u0634\u0646",
    confirmEnd: "\u062a\u0627\u06cc\u06cc\u062f \u067e\u0627\u06cc\u0627\u0646",
    effectsHint: "\u0628\u0631\u0627\u06cc \u0627\u062c\u0631\u0627 \u06a9\u0644\u06cc\u06a9 \u06a9\u0646\u06cc\u062f",
    chat: "\u06af\u0641\u062a\u06af\u0648",
    chatPlaceholder: "\u067e\u06cc\u0627\u0645 \u062e\u0648\u062f \u0631\u0627 \u0628\u0646\u0648\u06cc\u0633\u06cc\u062f...",
    leftArrow: "\u2039",
    rightArrow: "\u203a",
    party: "\u{1F389}",
    trophy: "\u{1F3C6}",
  };
  const isTextDark =
    typeof textColor === "string" &&
    ["#111827", "#000000"].includes(textColor.toLowerCase());
  const panelBackground = isTextDark
    ? "bg-white/80 backdrop-blur-sm ring-1 ring-black/10"
    : "bg-black/50 backdrop-blur-sm ring-1 ring-white/10";
  const iconHover = isTextDark ? "hover:bg-black/10" : "hover:bg-white/30";
  const iconHoverSoft = isTextDark
    ? "hover:bg-black/10"
    : "hover:bg-white/20";
  const numberBackground = isTextDark ? "bg-black/10" : "bg-white/40";
  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60";

  const handleReactionClick = (reactionLabel) => {
    const effectMap = {
      Confetti: "confetti",
      Applause: "applause",
      Drumroll: "drumroll",
    };
    setActiveEffect(effectMap[reactionLabel]);
    setShowReactions(false);
  };

  const handleReactionsEnter = () => {
    if (reactionCloseTimer) {
      clearTimeout(reactionCloseTimer);
      setReactionCloseTimer(null);
    }
    setShowReactions(true);
  };

  const handleReactionsLeave = () => {
    if (reactionCloseTimer) {
      clearTimeout(reactionCloseTimer);
    }
    const timer = setTimeout(() => setShowReactions(false), 180);
    setReactionCloseTimer(timer);
  };

  useEffect(() => {
    if (!confirmEnd) return undefined;
    const timer = setTimeout(() => setConfirmEnd(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmEnd]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return;
      const targetTag = event.target?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") return;
      if (event.code === "KeyC") {
        handleReactionClick("Confetti");
      } else if (event.code === "KeyA") {
        handleReactionClick("Applause");
      } else if (event.code === "KeyD") {
        handleReactionClick("Drumroll");
      } else {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const slideLabel = totalSlides
    ? `${currentSlide} / ${totalSlides}`
    : `${currentSlide}`;
  const isAtEnd = endOnLastSlide && totalSlides ? currentSlide >= totalSlides : false;
  const canGoNext =
    !!onNext || (onEnd && totalSlides && currentSlide >= totalSlides);
  const progressPercent =
    totalSlides && totalSlides > 0
      ? Math.min(100, Math.max(0, (currentSlide / totalSlides) * 100))
      : 0;

  return (
    <>
      <ReactionEffects
        effect={activeEffect}
        onComplete={() => setActiveEffect(null)}
      />

      <div
        className={`fixed ${
          qrOpen ? "left-[20%] right-0" : "left-0 right-0"
        } bottom-0 h-16 flex items-center justify-between px-6 z-50 text-[color:var(--quiz-text)]`}
      >
        <div
          className={`flex items-center gap-2 ${panelBackground} rounded-full px-2 py-1`}
          aria-label={labels.controls}
        >
          <div
            className="relative"
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
          />

          <div className="flex flex-col items-center gap-1">
            <div
              className={`px-3 py-1 ${numberBackground} rounded-full text-current text-sm font-semibold`}
              aria-label={`${labels.slide} ${slideLabel}`}
            >
              {labels.slide} {slideLabel}
            </div>
            {totalSlides ? (
              <div className="h-1 w-28 overflow-hidden rounded-full bg-white/40">
                <div
                  className="h-full rounded-full bg-emerald-400/80 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            ) : null}
          </div>

          <button
            onClick={() => {
              if (endOnLastSlide && onEnd && totalSlides && currentSlide >= totalSlides) {
                onEnd();
                return;
              }
              onNext?.();
            }}
            className={`h-11 px-5 ${focusRing} rounded-full flex items-center gap-2 cursor-pointer border-none transition-colors text-sm font-semibold ${
              isAtEnd ? "bg-emerald-500/25" : "bg-indigo-500/25"
            } ${iconHoverSoft} disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isAtEnd ? labels.end : labels.next}
            aria-label={isAtEnd ? labels.end : labels.next}
            disabled={!canGoNext}
          >
            {isAtEnd ? labels.end : labels.nextShort}
            <span className="text-lg">{labels.rightArrow}</span>
          </button>
        </div>

        <div
          className={`relative flex items-center gap-2 ${panelBackground} rounded-full px-2 py-1`}
        >
          <div onMouseEnter={handleReactionsEnter} onMouseLeave={handleReactionsLeave}>
            <button
              className={`h-11 w-11 ${iconHover} ${focusRing} rounded-full flex items-center justify-center text-current cursor-pointer border-none transition-colors text-lg`}
              title={labels.effects}
              aria-label={labels.effects}
            >
              {labels.party}
            </button>
          </div>

          <button
            onClick={() => onShowLeaderboard && onShowLeaderboard()}
            className={`h-11 w-11 ${iconHover} ${focusRing} rounded-full flex items-center justify-center text-current cursor-pointer border-none transition-colors text-lg`}
            title={labels.leaderboard}
            aria-label={labels.leaderboard}
          >
            {labels.trophy}
          </button>

          <button
            onClick={() => {
              if (!onEnd) return;
              if (confirmEnd) {
                onEnd();
                setConfirmEnd(false);
                return;
              }
              setConfirmEnd(true);
            }}
            className={`px-4 h-11 ${focusRing} rounded-full flex items-center justify-center cursor-pointer border-none transition-colors text-sm font-semibold ${
              confirmEnd ? "bg-red-500/90" : "bg-red-600/70 hover:bg-red-500/80"
            } text-white`}
            title={labels.endPresentation}
            aria-label={labels.endPresentation}
          >
            {confirmEnd ? labels.confirmEnd : labels.end}
          </button>

          {showReactions && (
            <div
              className="absolute bottom-16 right-0 bg-gray-900/95 rounded-2xl shadow-2xl z-50 p-3 w-64 max-w-[80vw] origin-bottom-right backdrop-blur-sm ring-1 ring-white/10"
              role="menu"
              aria-label={labels.effects}
              onMouseEnter={handleReactionsEnter}
              onMouseLeave={handleReactionsLeave}
            >
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-xs text-white/70">{labels.effects}</span>
                <span className="text-[10px] text-white/40">{labels.effectsHint}</span>
              </div>
              <div className="space-y-2">
                {reactions.map((reaction, index) => (
                  <button
                    key={index}
                    onClick={() => handleReactionClick(reaction.label)}
                    className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-800/80 rounded-xl text-white text-left border-none cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{reaction.icon}</span>
                      <span>{reaction.label}</span>
                    </div>
                    <span className="bg-gray-700/80 px-2 py-1 rounded text-xs font-mono">
                      {reaction.key}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showMenu && (
        <div
          className={`fixed ${
            qrOpen ? "left-[20%]" : "left-0"
          } top-0 bottom-0 w-72 bg-gray-800 z-50 shadow-2xl`}
          onMouseEnter={() => setShowMenu(true)}
          onMouseLeave={() => setShowMenu(false)}
        >
          <div className="flex flex-col p-4 gap-2">
            {menuItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  console.log(`Action: ${item.action}`);
                }}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-700 rounded text-white text-left border-none cursor-pointer transition-colors"
              >
                <span className="text-xl w-6">{item.icon}</span>
                <span className="whitespace-pre-line">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showChat && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowChat(false)}
          />
          <div className="fixed left-4 bottom-20 w-96 bg-gray-900 rounded-lg shadow-2xl z-50">
            <div className="flex items-center justify-between p-3 border-b border-gray-700">
              <h3 className="text-white font-semibold">{labels.chat}</h3>
              <button
                onClick={() => setShowChat(false)}
                className="text-white hover:text-gray-300 text-xl border-none bg-transparent cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-3 space-y-2">
              {chatMessages.map((msg, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="text-2xl">{msg.avatar}</span>
                  <span className="text-gray-300">
                    <strong>{msg.user}</strong> {msg.message}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-gray-700">
              <input
                type="text"
                placeholder={labels.chatPlaceholder}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
