import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAudio } from "../modules/live/react/AudioProvider";

export default function TopBar({
  accessCode = "",
  showQRButton = true,
  onQRToggle = null,
  isQROpen = false,
  isConnected = null,
}) {
  const { isMuted, toggleMute } = useAudio();
  const navigate = useNavigate();
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const joinUrl = `proslides.ir/${accessCode}`;

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

  const qrOpen = onQRToggle ? isQROpen : showQRModal;

  return (
    <div
      className={`fixed ${
        qrOpen ? "left-[20%] right-0" : "left-0 right-0"
      } top-0 h-14 bg-brand flex items-center justify-between px-5 z-50 transition-all duration-300 text-content-inverse`}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/manager/panel/")}
          className="w-9 h-9 pb-1 bg-black/15 rounded-full flex items-center justify-center text-current cursor-pointer border-none text-base hover:bg-black/25 transition-colors"
          aria-label="بازگشت"
        >
          {"\u2190"}
        </button>
        <button
          onClick={toggleMute}
          className="w-8 h-8 bg-black/15 rounded-full flex items-center justify-center text-current cursor-pointer border-none text-base hover:bg-black/25 transition-colors"
          aria-label={isMuted ? "روشن کردن صدا" : "بی‌صدا کردن"}
        >
          {isMuted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
        </button>
      </div>

      <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-2">
        <div className="font-medium text-[15px] flex items-center gap-2 whitespace-nowrap">
          برای ورود:{" "}
          <strong
            onClick={copyToClipboard}
            className="cursor-pointer hover:text-brand-soft transition-colors relative"
            title="برای کپی کلیک کنید"
          >
            proslides.ir/{accessCode}
            {copiedLink && (
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-success-ink text-content-inverse text-xs px-2 py-1 rounded whitespace-nowrap">
                کپی شد!
              </div>
            )}
          </strong>
        </div>
        {showQRButton && (
          <button
            onClick={handleQRToggle}
            className="w-7 h-7 bg-white/90 rounded flex items-center justify-center cursor-pointer border-none hover:bg-white transition-colors p-0.5"
            aria-label={qrOpen ? "بستن کد QR" : "نمایش کد QR"}
          >
            {qrOpen ? (
              <span className="text-gray-700 text-2xl font-bold leading-none">
                {"\u2716\uFE0F"}
              </span>
            ) : (
              <img
                src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxyZWN0IHdpZHRoPSI1IiBoZWlnaHQ9IjUiIHg9IjMiIHk9IjMiIHJ4PSIxIi8+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgeD0iMTYiIHk9IjMiIHJ4PSIxIi8+PHJlY3Qgd2lkdGg9IjUiIGhlaWdodD0iNSIgeD0iMyIgeT0iMTYiIHJ4PSIxIi8+PHBhdGggZD0iTTIxIDEzdjN2M3YzIi8+PHBhdGggZD0iTTE4IDIxaDNoMyIvPjxwYXRoIGQ9Ik0xMyAyMUgxMyIvPjxwYXRoIGQ9Ik0xMyAxOEgxMyIvPjxwYXRoIGQ9Ik0xMyAxNkgxMyIvPjxwYXRoIGQ9Ik0xMyAxM0gxMyIvPjxwYXRoIGQ9Ik0yMSAyMVYyMSIvPjwvc3ZnPg=="
                alt="کد QR"
                className="w-full h-full"
              />
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {typeof isConnected === "boolean" && (
          <div
            className="flex items-center gap-2 rounded-full bg-black/15 px-3 py-1 text-[11px] sm:text-xs font-medium text-current"
            role="status"
            aria-live="polite"
            aria-label={`وضعیت اتصال: ${isConnected ? "متصل" : "قطع"}`}
          >
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span>{isConnected ? "متصل" : "قطع"}</span>
          </div>
        )}
        <div className="font-semibold text-base flex items-center gap-1.5 before:content-['*'] before:text-xl">
          ProSlides
        </div>
      </div>
    </div>
  );
}
