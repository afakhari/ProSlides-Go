import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function LogoMark() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-[#111827] font-semibold text-lg before:content-['✱'] before:text-xl"
    >
      ProSlides
    </Link>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");

  const handleJoin = (event) => {
    event.preventDefault();
    const trimmed = accessCode.trim();
    if (!trimmed) return;
    navigate(`/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div
      className="min-h-screen text-[#111827]"
      style={{
        fontFamily: '"Outfit", "Segoe UI", sans-serif',
        background:
          "radial-gradient(circle at 10% 15%, rgba(236, 253, 245, 0.7) 0%, transparent 55%), radial-gradient(circle at 90% 10%, rgba(239, 246, 255, 0.7) 0%, transparent 50%), linear-gradient(180deg, #ffffff 0%, #f7fafc 100%)",
      }}
    >
      <div className="border-b border-[#e5e7eb] bg-[#f8fafc]">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-sm text-[#1f2937]">
          <span className="text-[#374151]">Are you a participant?</span>
          <form
            onSubmit={handleJoin}
            className="flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-3 py-1.5 shadow-[0_6px_14px_rgba(15,23,42,0.05)]"
          >
            <span className="pl-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9ca3af]">
              proslides/
            </span>
            <input
              type="text"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="enter code"
              className="w-24 border-none bg-transparent text-sm text-[#111827] outline-none placeholder:text-[#c0c6d0]"
              aria-label="Access code"
            />
            <button
              type="submit"
              className="rounded-full bg-[#111827] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#0f172a]"
            >
              Join
            </button>
          </form>
        </div>
      </div>

      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-4">
          <LogoMark />
          <div className="flex items-center gap-3 text-sm font-semibold">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-2 text-[#111827] transition hover:border-[#cbd5f5]"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="rounded-xl bg-[#5b2ecf] px-4 py-2 text-white shadow-[0_12px_28px_rgba(91,46,207,0.25)] transition hover:bg-[#4b25b1]"
            >
              Free sign up
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center px-6 pb-28 pt-20 text-center">
        <h1 className="text-4xl font-semibold leading-tight text-[#111827] md:text-6xl">
          The all-in-one platform for{" "}
          <span className="text-[#1bb783]">engaging</span> presentations
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[#6b7280] md:text-lg">
          Bring every room into the conversation with live, interactive slides
          built for clarity and momentum.
        </p>
        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="mt-8 rounded-2xl bg-[#5b2ecf] px-8 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(91,46,207,0.3)] transition hover:bg-[#4b25b1]"
        >
          Try it for free
        </button>
      </main>
    </div>
  );
}
