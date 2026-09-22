import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

function Cloud({
  className,
  style,
}: {
  className: string;
  style?: CSSProperties;
}) {
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true" className={className} style={style}>
      <path d="M62 94h65a33 33 0 0 0 3-66 40 40 0 0 0-78 11A29 29 0 0 0 62 94Z" fill="#D6E8FF" />
    </svg>
  );
}

function ArcticStar({ className, style }: { className: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={\`\${className} flex items-center justify-center text-[64px]\`} style={style}>❄️</div>;
}

function Wand({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={className} style={style}>
      <rect x="12" y="74" width="90" height="12" rx="6" transform="rotate(-35 12 74)" fill="#6D6BC7" />
      <rect x="16" y="68" width="90" height="8" rx="4" transform="rotate(-35 16 68)" fill="#F7B731" />
      <path d="M96 18l6 12 12 6-12 6-6 12-6-12-12-6 12-6 6-12Z" fill="#FFC857" />
      <circle cx="76" cy="30" r="4" fill="#FFC857" />
      <circle cx="110" cy="54" r="4" fill="#FFC857" />
    </svg>
  );
}

export default function AuthBackdrop({ decorate = true }: { decorate?: boolean }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,#ffffff_0%,#f3f8ff_45%,transparent_65%),radial-gradient(circle_at_90%_15%,#eef5ff_0%,transparent_55%),radial-gradient(circle_at_80%_90%,#e8f2ff_0%,transparent_55%),linear-gradient(180deg,#f8fbff_0%,#f1f6ff_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(#dce6f4_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute inset-x-0 top-6 z-10 px-6 md:px-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="hidden md:block" />
          <Link to="/" className="inline-flex items-center gap-1.5 text-lg font-semibold text-content before:text-xl before:content-['✱']">
            ProSlides
          </Link>
          <div />
        </div>
      </div>
      {decorate && (
        <div className="pointer-events-none absolute inset-0 z-[1] hidden md:block">
          <Cloud className="absolute left-[10%] top-[22%] w-[200px] opacity-90 animate-[auth-float_6s_ease-in-out_infinite]" />
          <Cloud className="absolute bottom-[18%] right-[8%] w-[200px] opacity-90 animate-[auth-float_6s_ease-in-out_infinite]" style={{ animationDelay: "1.2s" }} />
          <ArcticStar className="absolute bottom-[18%] left-[16%] w-[140px] animate-[auth-float_7s_ease-in-out_infinite]" style={{ animationDelay: "0.4s" }} />
          <Wand className="absolute right-[18%] top-[30%] w-[140px] animate-[auth-float_5s_ease-in-out_infinite]" style={{ animationDelay: "0.8s" }} />
        </div>
      )}
    </>
  );
}
