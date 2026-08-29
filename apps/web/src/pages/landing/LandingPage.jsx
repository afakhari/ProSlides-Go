import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../../components/Seo";

const NAV_ITEMS = [
  { id: "home", label: "خانه" },
  { id: "features", label: "ویژگی‌ها" },
  { id: "how", label: "نحوه کار" },
  { id: "audience", label: "مخاطبان" },
];

const FEATURE_LIST = [
  {
    title: "اسلایدهای تعاملی",
    description: "اسلایدها، نظرسنجی‌ها و آزمون‌ها را در یک جریان یکپارچه بسازید.",
    Icon: function SlideIcon() {
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            d="M4 6.5c0-1.1.9-2 2-2h8.5l5.5 5.5V17.5c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V6.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M14.5 4.5v5h5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    },
  },
  {
    title: "تعامل زنده",
    description: "پاسخ‌ها را لحظه‌ای ببینید و ارائه را براساس مخاطب تنظیم کنید.",
    Icon: function LiveIcon() {
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            d="M5 12c0-3.9 3.1-7 7-7s7 3.1 7 7-3.1 7-7 7-7-3.1-7-7Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M12 8v4l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    },
  },
  {
    title: "برندینگ حرفه‌ای",
    description: "رنگ، فونت و امضای بصری خود را روی تمام اسلایدها یکدست کنید.",
    Icon: function PaletteIcon() {
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            d="M12 4.5a7.5 7.5 0 0 0 0 15h2.5a2.5 2.5 0 0 0 0-5H13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="8" cy="10" r="1" fill="currentColor" />
          <circle cx="10.5" cy="7.5" r="1" fill="currentColor" />
          <circle cx="14" cy="7.5" r="1" fill="currentColor" />
        </svg>
      );
    },
  },
  {
    title: "هم‌راستای تیم",
    description: "بازخوردها، تصمیم‌ها و نتایج را در یک داشبورد شفاف نگه دارید.",
    Icon: function TeamIcon() {
      return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            d="M8 12.5c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3Zm8.5-.5c1.4 0 2.5-1.1 2.5-2.5S17.9 7 16.5 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M3.5 18c0-2.2 2.1-4 4.5-4h1c2.4 0 4.5 1.8 4.5 4M13.5 18c.2-1.4 1.7-2.5 3.5-2.5h.8c1.8 0 3.3 1.1 3.7 2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      );
    },
  },
];

const STEP_LIST = [
  {
    title: "ایده را بسازید",
    description: "از قالب‌های آماده شروع کنید یا اسلایدهای خودتان را وارد کنید.",
  },
  {
    title: "تعامل را فعال کنید",
    description: "سؤال، نظرسنجی یا مسابقه اضافه کنید تا همه‌ها درگیر شوند.",
  },
  {
    title: "نتیجه را تحلیل کنید",
    description: "بعد از ارائه، گزارش‌های قابل استفاده را با تیم به اشتراک بگذارید.",
  },
];

const USE_CASES = [
  "مدرس‌ها و دانشگاه‌ها",
  "دوره‌های شرکتی",
  "رویدادهای حضوری",
  "وبینارها",
  "جلسات فروش",
  "کارگاه‌های تیمی",
];


function SectionHeader({ title, description }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#64748b]">
        ProSlides
      </p>
      <h2 className="text-2xl font-semibold text-[#0f172a] md:text-3xl">{title}</h2>
      <p className="text-sm text-[#64748b] md:text-base">{description}</p>
    </div>
  );
}

function FeatureCard({ title, description, Icon }) {
  const IconElement = Icon ? <Icon /> : null;
  return (
    <div className="group flex h-full flex-col gap-4 rounded-3xl border border-[#e2e8f0] bg-white p-6 shadow-[0_18px_36px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-[#c7d2fe]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#4f46e5]">
        {IconElement}
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-[#0f172a]">{title}</h3>
        <p className="text-sm leading-relaxed text-[#64748b]">{description}</p>
      </div>
    </div>
  );
}

function StepCard({ index, title, description }) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-3xl border border-[#e2e8f0] bg-white/70 p-6 shadow-[0_16px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111827] text-sm font-semibold text-white">
          {index}
        </span>
        <h3 className="text-lg font-semibold text-[#0f172a]">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-[#64748b]">{description}</p>
      <div className="mt-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#a5b4fc]">
        مرحله {index}
      </div>
    </div>
  );
}

function UseCaseChip({ children }) {
  return (
    <span className="rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#475569] shadow-[0_10px_18px_rgba(15,23,42,0.06)]">
      {children}
    </span>
  );
}


export default function LandingPage() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [activeSection, setActiveSection] = useState("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleJoin = (event) => {
    event.preventDefault();
    const trimmed = accessCode.trim();
    if (!trimmed) return;
    navigate(`/${encodeURIComponent(trimmed)}`);
  };

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(Boolean);
    if (!sections.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        root: null,
        threshold: 0.4,
        rootMargin: "-80px 0px -50% 0px",
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  const handleScrollTo = (id) => {
    const target = document.getElementById(id);
    if (!target) return;
    setIsMenuOpen(false);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      className="min-h-screen text-[#0f172a]"
      dir="rtl"
      style={{ fontFamily: '"Vazirmatn", "Outfit", "Segoe UI", sans-serif' }}
    >
      <Seo
        title="پرو اسلایدز | ارائه‌های تعاملی و حرفه‌ای"
        description="پرو اسلایدز پلتفرم ایرانی ارائه‌های تعاملی است؛ نظرسنجی زنده، کوئیز، و اسلایدهای مشارکتی برای کلاس‌ها و تیم‌ها."
        canonical="https://proslides.ir/"
      />

      <div className="relative overflow-hidden bg-gradient-to-b from-white via-[#f8fafc] to-[#eef2ff]">
        <div className="pointer-events-none absolute -right-24 top-12 h-72 w-72 rounded-full bg-[#dbeafe]/60 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-64 h-72 w-72 rounded-full bg-[#ede9fe]/60 blur-3xl" />

        <div className="border-b border-[#e2e8f0] bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-2 text-sm text-[#1f2937]">
            <span className="text-[#475569]">شرکت‌کننده هستید؟ کد ورود را وارد کنید.</span>
            <form
              onSubmit={handleJoin}
              className="flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-3 py-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-center gap-2" dir="ltr">
                <span className="text-[11px] font-semibold tracking-[0.14em] text-[#64748b]">
                  proslides.ir/
                </span>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  placeholder="کد را وارد کنید"
                  className="w-28 border-none bg-transparent text-center text-sm text-[#111827] placeholder:text-[#94a3b8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/30"
                  autoComplete="off"
                  spellCheck="false"
                  aria-label="کد ورود"
                  dir="rtl"
                />
              </div>
              <button
                type="submit"
                className="rounded-full bg-[#111827] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#0f172a]"
              >
                ورود
              </button>
            </form>
          </div>
        </div>

        <header className="sticky top-0 z-50 border-b border-[#e2e8f0] bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e2e8f0] text-[#111827] transition hover:border-[#c7d2fe] md:hidden"
                aria-expanded={isMenuOpen}
                aria-controls="landing-nav"
                onClick={() => setIsMenuOpen((prev) => !prev)}
              >
                <span className="sr-only">باز و بسته کردن منو</span>
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => handleScrollTo("home")}
                className="inline-flex items-center gap-1.5 text-lg font-semibold text-[#111827] before:text-xl before:content-['✱']"
                aria-label="بازگشت به ابتدای صفحه"
              >
                ProSlides
              </button>
            </div>

            <nav
              className="hidden items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-2 py-1 text-sm font-semibold text-[#64748b] md:flex"
              aria-label="بخش‌های صفحه"
            >
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleScrollTo(item.id)}
                  className={`rounded-full px-4 py-2 transition ${activeSection === item.id
                    ? "bg-[#111827] text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)]"
                    : "hover:text-[#0f172a]"
                    }`}
                  aria-current={activeSection === item.id ? "true" : undefined}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
              <Link
                to="/login"
                className="rounded-xl border border-[#e5e7eb] bg-white px-3 py-1.5 text-[#111827] transition hover:border-[#cbd5f5] sm:px-4 sm:py-2"
              >
                ورود
              </Link>
              <Link
                to="/signup"
                className="rounded-xl bg-[#5b2ecf] px-3 py-1.5 text-white shadow-[0_12px_28px_rgba(91,46,207,0.25)] transition hover:bg-[#4b25b1] sm:px-4 sm:py-2"
              >
                ثبت‌نام رایگان
              </Link>
            </div>
          </div>

          {isMenuOpen && (
            <div
              id="landing-nav"
              className="border-t border-[#e2e8f0] bg-white px-4 py-4 md:hidden"
            >
              <nav className="flex flex-col gap-3 text-sm font-semibold text-[#64748b]">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleScrollTo(item.id)}
                    className={`rounded-2xl px-4 py-3 text-right transition ${activeSection === item.id
                      ? "bg-[#111827] text-white"
                      : "bg-[#f8fafc] text-[#0f172a]"
                      }`}
                    aria-current={activeSection === item.id ? "true" : undefined}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          )}
        </header>

        <main className="mx-auto flex max-w-6xl flex-col gap-24 px-6 pb-28 pt-16">
          <section id="home" className="scroll-mt-28 md:scroll-mt-32">
            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="text-center lg:text-right">
                <p className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white/80 px-4 py-1 text-xs font-semibold text-[#64748b]">
                  ارائه‌های تعاملی برای تیم‌های مدرن
                </p>
                <h1 className="mt-6 text-4xl font-semibold leading-tight text-[#0f172a] md:text-6xl">
                  <span className="block">پلتفرم همه‌کاره برای ارائه‌های</span>
                  <span className="block">
                    <span className="multi-text" data-longest="اثرگذار">
                      <span className="status">تعاملی</span>
                      <span className="status">جذاب</span>
                      <span className="status">اثرگذار</span>
                    </span>{" "}
                    و حرفه‌ای
                  </span>
                </h1>
                <p className="mt-6 max-w-2xl text-base text-[#64748b] md:text-lg">
                  با اسلایدهای زنده و ابزارهای مشارکتی، تعامل را بالا ببرید و ارائه‌ای شفاف، منسجم و تاثیرگذار بسازید.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                  <button
                    type="button"
                    onClick={() => navigate("/signup")}
                    className="rounded-2xl bg-[#4f46e5] px-8 py-3 text-base font-semibold text-white shadow-[0_18px_40px_rgba(79,70,229,0.35)] transition hover:bg-[#4338ca]"
                  >
                    رایگان شروع کنید
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollTo("features")}
                    className="rounded-2xl border border-[#e2e8f0] bg-white px-8 py-3 text-base font-semibold text-[#111827] shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-1"
                  >
                    دیدن ویژگی‌ها
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 translate-x-6 translate-y-6 rounded-[32px] bg-[#e0e7ff]" />
                <div className="relative rounded-[32px] border border-[#e2e8f0] bg-white p-6 shadow-[0_24px_50px_rgba(15,23,42,0.16)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.24em] text-[#64748b]">
                      Live session
                    </span>
                    <span className="rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#16a34a]">
                      آنلاین
                    </span>
                  </div>
                  <div className="mt-6 space-y-4">
                    {["نظرسنجی لحظه‌ای", "کوئیز پویا", "اسلاید مشارکتی"].map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3"
                      >
                        <span className="text-sm font-semibold text-[#0f172a]">{item}</span>
                        <span className="h-2 w-20 rounded-full bg-[#c7d2fe]" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl bg-[#111827] px-4 py-3 text-sm font-semibold text-white">
                    94% مشارکت فعال در جلسه‌های اخیر
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="scroll-mt-28 md:scroll-mt-32">
            <SectionHeader
              title="ویژگی‌هایی که ارائه را ارتقا می‌دهند"
              description="هر ارائه‌ای که می‌سازید، می‌تواند تعاملی‌تر، سریع‌تر و حرفه‌ای‌تر باشد."
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {FEATURE_LIST.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </section>

          <section id="how" className="scroll-mt-28 md:scroll-mt-32">
            <div className="rounded-[40px] border border-[#e2e8f0] bg-white/80 p-10 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <SectionHeader
                title="در سه قدم شروع کنید"
                description="مسیر اجرای یک ارائه تعاملی از ساخت تا تحلیل، کاملاً ساده و شفاف است."
              />
              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {STEP_LIST.map((step, index) => (
                  <StepCard key={step.title} index={index + 1} {...step} />
                ))}
              </div>
            </div>
          </section>

          <section id="audience" className="scroll-mt-28 md:scroll-mt-32">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <SectionHeader
                  title="برای هر مخاطب، یک تجربه درگیرکننده"
                  description="از کلاس درس تا جلسه فروش، پرو اسلایدز برای سناریوهای مختلف آماده است."
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                  {USE_CASES.map((item) => (
                    <UseCaseChip key={item}>{item}</UseCaseChip>
                  ))}
                </div>
              </div>
              <div className="rounded-[32px] border border-[#e2e8f0] bg-[#111827] p-8 text-white shadow-[0_24px_50px_rgba(15,23,42,0.25)]">
                <h3 className="text-center text-2xl font-semibold">
                  آماده‌اید ارائه‌های بعدی را متحول کنید؟
                </h3>
                <p className="mt-4 text-center text-sm text-white/80">
                  تجربه‌ای سریع و مدرن برای تعامل واقعی. از همین امروز شروع کنید.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/signup")}
                    className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-[#111827] transition hover:-translate-y-1"
                  >
                    ایجاد حساب رایگان
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollTo("home")}
                    className="rounded-2xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    بازگشت به بالا
                  </button>
                </div>
              </div>
            </div>
          </section>

          <p className="mt-10 text-center text-xs text-[#64748b] md:text-sm">
            ساخته شده توسط تیم ProSlides
            {" — "}
            <Link
              to="/team"
              className="font-semibold text-[#64748b] transition hover:text-[#0f172a]"
            >
              آشنایی با تیم
            </Link>
          </p>
        </main>
      </div>
    </div>
  );
}
