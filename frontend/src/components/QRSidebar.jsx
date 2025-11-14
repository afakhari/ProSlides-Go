import React, { useState } from "react";

export default function QRSidebar({ gameCode = "ZH4NJ", isOpen, onClose }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const joinUrl = `ahaslides.com/${gameCode}`;

  // Function to copy link to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(`https://${joinUrl}`).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed left-0 top-0 bottom-0 w-[20%] bg-gray-700 flex flex-col items-center justify-center gap-6 p-8 z-40 shadow-2xl">
      <button
        onClick={onClose}
        className="absolute top-3.5 right-4 w-8 h-8 pb-1 bg-gray-600 hover:bg-gray-500 rounded-full text-white text-2xl flex items-center justify-center border-none cursor-pointer transition-colors"
        aria-label="Close"
      >
        ×
      </button>
      <div className="bg-white p-4 rounded-lg">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
            "https://" + joinUrl
          )}`}
          alt="QR Code"
          className="w-[200px] h-[200px]"
        />
      </div>
      <div className="text-white text-center">
        <div className="text-lg font-semibold mb-2">Join at:</div>
        <div
          onClick={copyToClipboard}
          className="text-2xl font-bold break-words cursor-pointer hover:text-blue-300 transition-colors relative"
          title="Click to copy"
        >
          {joinUrl}
          {copiedLink && (
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-sm px-3 py-1 rounded whitespace-nowrap">
              Copied!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
