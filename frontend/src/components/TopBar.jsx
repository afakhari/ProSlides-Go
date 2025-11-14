import React, { useState } from "react";

export default function TopBar({
  gameCode = "ZH4NJ",
  showQRButton = true,
  onQRToggle = null,
  isQROpen = false,
}) {
  const [isMuted, setIsMuted] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const joinUrl = `ahaslides.com/${gameCode}`;

  // Function to copy link to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(`https://${joinUrl}`).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleQRToggle = () => {
    const newState = !showQRModal;
    setShowQRModal(newState);
    if (onQRToggle) {
      onQRToggle(newState);
    }
  };

  // Use external state if provided, otherwise use internal state
  const qrOpen = onQRToggle ? isQROpen : showQRModal;

  return (
    <div
      className={`fixed ${
        qrOpen ? "left-[20%] right-0" : "left-0 right-0"
      } top-0 h-14 bg-pink-200 flex items-center justify-between px-5 z-50 transition-all duration-300`}
    >
      <div className="flex items-center gap-2">
        <button
          className="w-9 h-9 pb-1 bg-black/15 rounded-full flex items-center justify-center text-white cursor-pointer border-none text-base hover:bg-black/25 transition-colors"
          aria-label="Back"
        >
          ←
        </button>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="w-8 h-8 bg-black/15 rounded-full flex items-center justify-center text-white cursor-pointer border-none text-base hover:bg-black/25 transition-colors"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* Center section with link and QR */}
      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
        <div className="text-white font-medium text-[15px] flex items-center gap-2 whitespace-nowrap">
          To join, go to:{" "}
          <strong
            onClick={copyToClipboard}
            className="cursor-pointer hover:text-blue-200 transition-colors relative"
            title="Click to copy"
          >
            ahaslides.com/{gameCode}
            {copiedLink && (
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                Copied!
              </div>
            )}
          </strong>
        </div>
        {showQRButton && (
          <button
            onClick={handleQRToggle}
            className="w-7 h-7 bg-white/90 rounded flex items-center justify-center cursor-pointer border-none hover:bg-white transition-colors p-0.5"
            aria-label={qrOpen ? "Close QR Code" : "Show QR Code"}
          >
            {qrOpen ? (
              <span className="text-gray-700 text-2xl font-bold leading-none">
                ✖️
              </span>
            ) : (
              <img
                src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSI1IiBoZWlnaHQ9IjUiIHg9IjMiIHk9IjMiIHJ4PSIxIi8+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgeD0iMTYiIHk9IjMiIHJ4PSIxIi8+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgeD0iMyIgeT0iMTYiIHJ4PSIxIi8+PHBhdGggZD0iTTIxIDEzdjN2M3YzIi8+PHBhdGggZD0iTTE4IDIxaDNoMyIvPjxwYXRoIGQ9Ik0xMyAyMUgxMyIvPjxwYXRoIGQ9Ik0xMyAxOEgxMyIvPjxwYXRoIGQ9Ik0xMyAxNkgxMyIvPjxwYXRoIGQ9Ik0xMyAxM0gxMyIvPjxwYXRoIGQ9Ik0yMSAyMVYyMSIvPjwvc3ZnPg=="
                alt="QR Code"
                className="w-full h-full"
              />
            )}
          </button>
        )}
      </div>

      <div className="text-white font-semibold text-base flex items-center gap-1.5 before:content-['✱'] before:text-xl">
        ProSlides
      </div>
    </div>
  );
}
