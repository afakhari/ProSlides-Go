import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import notFoundIllustration from "../../assets/404.svg";
import SiteHeader from "../../components/SiteHeader";

export default function NotFoundRoute() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = accessCode.trim();
    if (code) navigate(`/${encodeURIComponent(code)}`);
  }

  return (
    <div className="min-h-screen bg-surface text-content" dir="rtl">
      <div className="border-b border-border-subtle bg-surface-raised">
        <form className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 py-2 text-sm" onSubmit={handleJoin}>
          <label htmlFor="not-found-access-code">شرکت‌کننده هستید؟</label>
          <div className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1.5 shadow-sm">
            <span className="text-xs text-content-muted" dir="ltr">proslides.ir/</span>
            <input id="not-found-access-code" className="w-28 bg-transparent text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="کد ورود" autoComplete="off" spellCheck={false} dir="ltr" />
            <button type="submit" className="rounded-full bg-content px-4 py-2 text-xs font-semibold text-content-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">ورود</button>
          </div>
        </form>
      </div>
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2">
        <img src={notFoundIllustration} alt="" className="mx-auto w-full max-w-sm" />
        <div className="text-center md:text-start">
          <h1 className="text-4xl font-semibold">صفحه پیدا نشد</h1>
          <p className="mt-4 text-content-muted">آدرس واردشده معتبر نیست. کد ورود را بررسی کنید یا به صفحهٔ اصلی برگردید.</p>
          <button type="button" onClick={() => navigate("/")} className="mt-8 rounded-2xl bg-brand px-8 py-3 font-semibold text-content-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">بازگشت به صفحهٔ اصلی</button>
        </div>
      </main>
    </div>
  );
}
