import React, { useState } from "react";
import {
  DefaultFooterStats,
  DefaultChatMessages,
  FooterMenuItems,
  KeyboardShortcuts,
  Reactions,
} from "../data/mockData";

export default function Footer({
  currentSlide = 1,
  totalSlides = 3,
  stats = DefaultFooterStats,
  showQRButton = true,
  onQRToggle = null,
  isQROpen = false,
  onShowLeaderboard = null,
  onNext = null,
  onPrevious = null,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [chatMessages] = useState(DefaultChatMessages);

  const menuItems = FooterMenuItems;
  const shortcuts = KeyboardShortcuts;
  const reactions = Reactions;

  const qrOpen = onQRToggle ? isQROpen : false;

  return (
    <>
      {/* Footer */}
      <div
        className={`fixed ${
          qrOpen ? "left-[20%] right-0" : "left-0 right-0"
        } bottom-0 h-16 flex items-center justify-between px-6 z-50`}
      >
        {/* Left section - Menu and Navigation */}
        <div className="flex items-center gap-2 bg-black/40 rounded-full pb-1 pl-2 pr-2 mb-2">
          <div
            className="relative"
            onMouseEnter={() => setShowMenu(true)}
            onMouseLeave={() => setShowMenu(false)}
          >
            <button
              className="w-10 h-10 hover:bg-white/30 rounded-full flex items-center justify-center text-white cursor-pointer border-none transition-colors"
              aria-label="Menu"
            >
              ☰
            </button>
          </div>

          <button
            onClick={() => onPrevious && onPrevious()}
            className="w-8 h-8 hover:bg-white/30 rounded-full flex items-center justify-center text-white cursor-pointer border-none transition-colors"
          >
            {"<"}
          </button>

          <div className="px-4 bg-white/40 rounded text-white font-semibold">
            {currentSlide}
          </div>

          <button
            onClick={() => onNext && onNext()}
            className="w-8 h-8 hover:bg-white/20 rounded-full flex items-center justify-center text-white cursor-pointer border-none transition-colors"
          >
            {">"}
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className="w-10 h-10 hover:bg-white/30 rounded-full flex items-center justify-center text-white cursor-pointer border-none transition-colors text-lg"
          >
            💬
          </button>

          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="w-10 h-10 hover:bg-white/30 rounded-full flex items-center justify-center text-white cursor-pointer border-none transition-colors text-lg font-bold"
          >
            K
          </button>

          <div
            className="relative"
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
          >
            <button className="w-10 h-10 hover:bg-white/30 rounded-full flex items-center justify-center text-white cursor-pointer border-none transition-colors text-lg">
              🎉
            </button>
          </div>

          <button
            onClick={() => onShowLeaderboard && onShowLeaderboard()}
            className="w-10 h-10 hover:bg-white/30 rounded-full flex items-center justify-center text-white cursor-pointer border-none transition-colors text-lg"
          >
            🏆
          </button>
        </div>

        {/* Right section - Stats */}
        <div className="flex items-center gap-2 bg-black/40 rounded-full pb-1 mb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded text-white">
            <span>❤️</span>
            <span className="font-semibold">{stats.hearts}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded text-white">
            <span>😊</span>
            <span className="font-semibold">{stats.happy}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded text-white">
            <span>⭐</span>
            <span className="font-semibold">{stats.star}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded text-white">
            <span>👍</span>
            <span className="font-semibold">{stats.thumbsUp}</span>
          </div>

          <div className="flex items-center gap-2 px-3 rounded text-white">
            <span>👥</span>
            <span className="font-semibold">
              {stats.players.current}/{stats.players.max}
            </span>
          </div>
        </div>
      </div>

      {/* Side Menu - Opens on Hover */}
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

      {/* Chat Panel */}
      {showChat && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowChat(false)}
          />
          <div className="fixed left-4 bottom-20 w-96 bg-gray-900 rounded-lg shadow-2xl z-50">
            <div className="flex items-center justify-between p-3 border-b border-gray-700">
              <h3 className="text-white font-semibold">Chat</h3>
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
                placeholder="Enter your message..."
                className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>
        </>
      )}

      {/* Shortcuts Panel */}
      {showShortcuts && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowShortcuts(false)}
          />
          <div className="fixed left-80 bottom-20 bg-white rounded-lg shadow-2xl z-50 p-4 w-80">
            <div className="space-y-2">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2"
                >
                  <span className="text-gray-700 text-sm">
                    {shortcut.label}
                  </span>
                  <span className="bg-gray-200 px-3 py-1 rounded text-xs font-mono font-semibold text-gray-800">
                    {shortcut.key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Reactions Menu - Opens on Hover */}
      {showReactions && (
        <div
          className={`fixed ${
            qrOpen ? "left-[33%]" : "left-50"
          } bottom-14 bg-gray-900 rounded-lg shadow-2xl z-50 p-3 min-w-56`}
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          <div className="space-y-2">
            {reactions.map((reaction, index) => (
              <button
                key={index}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-gray-800 rounded text-white text-left border-none cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{reaction.icon}</span>
                  <span>{reaction.label}</span>
                </div>
                <span className="bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                  {reaction.key}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
