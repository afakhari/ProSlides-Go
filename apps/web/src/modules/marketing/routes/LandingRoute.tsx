import { useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  LayoutTemplate,
  RadioTower,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import Seo from "../../../shared/ui/Seo.tsx";

type SectionId = "home" | "features" | "how" | "audience";

type NavItem = {
  id: SectionId;
  label: string;
};

type Feature = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "خانه" },
  { id: "features", label: "ویژگی‌ها" },
  { id: "how", label: "نحوه کار" },
  { id: "audience", label: "مخاطبان" },
];

const FEATURE_LIST: Feature[] = [
  {
    title: "اسلایدهای تعاملی",
    description:
      "اسلاید، سؤال، نظرسنجی و کوئیز را در یک جریان واحد طراحی و اجرا کنید.",
    Icon: LayoutTemplate,
  },
  {
    title: "تعامل زنده",
    description:
      "پاسخ‌ها و وضعیت جلسه را زنده دنبال کنید و ارائه را با مخاطبان هماهنگ نگه دارید.",
    Icon: RadioTower,
  },
  {
    title: "گزارش و نتیجه",
    description:
      "پس از ارائه، نتیجه‌ها را برای مرور عملکرد و تصمیم‌های بعدی در اختیار داشته باشید.",
    Icon: BarChart3,
  },
  {
    title: "تجربه هماهنگ تیمی",
    description:
      "ارائه‌دهنده و شرکت‌کنندگان یک تجربه فارسی، واکنش‌گرا و هماهنگ دریافت می‌کنند.",
    Icon: UsersRound,
  },
];

const STEP_LIST = [
  {
    title: "ارائه را بسازید",
    description:
      "اسلایدهای محتوایی و تعاملی را در ویرایشگر آماده و ظاهر ارائه را تنظیم کنید.",
  },
  {
    title: "جلسه را اجرا کنید",
    description:
      "کد ورود را با مخاطبان به اشتراک بگذارید و جریان ارائه را زنده مدیریت کنید.",
  },
  {
    title: "نتیجه را مرور کنید",
    description:
      "بعد از پایان جلسه، پاسخ‌ها و گزارش ارائه را برای تحلیل بعدی بررسی کنید.",
  },
] as const;

const USE_CASES = [
  "کلاس و دانشگاه",
  "دوره‌های سازمانی",
  "رویدادهای حضوری",
  "وبینارها",
  "جلسات فروش",
  "کارگاه‌های تیمی",
] as const;

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
      <p
        className="text-xs font-semibold uppercase tracking-[0.24em] text-content-muted"
        dir="ltr"
      >
        ProSlides
      </p>
      <h2 className="text-2xl font-semibold text-content md:text-3xl">
        {title}
      </h2>
      <p className="text-sm leading-7 text-content-muted md:text-base">
        {description}
      </p>
    </div>
  );
}

function FeatureCard({ title, description, Icon }: Feature) {
  return (
    <article className="group flex h-full flex-col gap-4 rounded-3xl border border-border-subtle bg-surface p-6 shadow-panel transition-transform hover:-translate-y-1">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-content">{title}</h3>
        <p className="text-sm leading-7 text-content-muted">{description}</p>
      </div>
    </article>
  );
}

function StepCard({
  index,
  title,
  description,
}: {
  index: number;
  title: string;
  description: string;
}) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-3xl border border-border-subtle bg-surface p-6 shadow-panel">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-content text-sm font-semibold text-content-inverse">
          {index.toLocaleString("fa-IR")}
        </span>
        <h3 className="text-lg font-semibold text-content">{title}</h3>
      </div>
      <p className="text-sm leading-7 text-content-muted">{description}</p>
      <p className="mt-auto text-xs font-semibold text-brand">
        مرحله {index.toLocaleString("fa-IR")}
      </p>
    </article>
  );
}

export default function LandingRoute() {
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [activeSection, setActiveSection] = useState<SectionId>("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = accessCode.trim();
    if (!trimmed) return;
    navigate(`/${encodeURIComponent(trimmed)}`);
  };

  useEffect(() => {
    const sections = NAV_ITEMS.map((item) =>
      document.getElementById(item.id),
    ).filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0 || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)
          .at(0);

        if (visible && NAV_ITEMS.some((item) => item.id === visible.target.id)) {
          setActiveSection(visible.target.id as SectionId);
        }
      },
      {
        threshold: [0.25, 0.5, 0.75],
        rootMargin: "-88px 0px -45% 0px",
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const handleScrollTo = (id: SectionId) => {
    const target = document.getElementById(id);
    if (!target) return;

    setIsMenuOpen(false);
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen bg-canvas text-content" dir="rtl">
      <Seo
        title="پرو اسلایدز | ارائه‌های تعاملی و حرفه‌ای"
        description="پرو اسلایدز پلتفرم ارائه تعاملی برای ساخت اسلاید، کوئیز، مشارکت زنده و مرور نتیجه جلسه است."
        canonical="https://proslides.ir/"
      />

      <div className="relative overflow-hidden bg-gradient-to-b from-surface via-canvas to-brand-soft">
        <div className="pointer-events-none absolute -end-24 top-12 h-72 w-72 rounded-full bg-info-soft blur-3xl" />
        <div className="pointer-events-none absolute -start-24 top-64 h-72 w-72 rounded-full bg-brand-muted blur-3xl" />

        <div className="border-b border-border-subtle bg-surface/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-4 py-2 text-sm">
            <span className="text-content-muted">
              شرکت‌کننده هستید؟ کد ورود را وارد کنید.
            </span>
            <form
              onSubmit={handleJoin}
              className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1.5 shadow-sm"
            >
              <div className="flex items-center gap-2" dir="ltr">
                <span className="text-[11px] font-semibold tracking-[0.14em] text-content-muted">
                  proslides.ir/
                </span>
                <input
                  type="text"
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
                  placeholder="کد ورود"
                  className="w-28 border-none bg-transparent text-center text-sm text-content placeholder:text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="کد ورود"
                  dir="ltr"
                />
              </div>
              <button
                type="submit"
                className="min-h-9 rounded-full bg-content px-4 py-1.5 text-xs font-semibold text-content-inverse transition-colors hover:bg-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                ورود
              </button>
            </form>
          </div>
        </div>

        <header className="sticky top-0 z-50 border-b border-border-subtle bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border-subtle text-content transition-colors hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:hidden"
                aria-expanded={isMenuOpen}
                aria-controls="landing-nav"
                onClick={() => setIsMenuOpen((current) => !current)}
              >
                <span className="sr-only">باز و بسته کردن منو</span>
                <span aria-hidden="true" className="text-xl">
                  ☰
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleScrollTo("home")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-lg font-semibold text-content before:text-xl before:content-['✱'] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="بازگشت به ابتدای صفحه"
                dir="ltr"
              >
                ProSlides
              </button>
            </div>

            <nav
              className="hidden items-center gap-1 rounded-full border border-border-subtle bg-surface px-2 py-1 text-sm font-semibold text-content-muted md:flex"
              aria-label="بخش‌های صفحه"
            >
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleScrollTo(item.id)}
                  className={`min-h-10 rounded-full px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                    activeSection === item.id
                      ? "bg-content text-content-inverse"
                      : "hover:text-content"
                  }`}
                  aria-current={
                    activeSection === item.id ? "location" : undefined
                  }
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
              <Link
                to="/login"
                className="min-h-11 rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-content transition-colors hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4"
              >
                ورود
              </Link>
              <Link
                to="/signup"
                className="min-h-11 rounded-xl bg-brand px-3 py-2.5 text-content-inverse shadow-sm transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4"
              >
                ثبت‌نام رایگان
              </Link>
            </div>
          </div>

          {isMenuOpen ? (
            <nav
              id="landing-nav"
              className="border-t border-border-subtle bg-surface px-4 py-4 md:hidden"
              aria-label="بخش‌های صفحه در موبایل"
            >
              <div className="flex flex-col gap-2 text-sm font-semibold">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleScrollTo(item.id)}
                    className={`min-h-11 rounded-2xl px-4 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                      activeSection === item.id
                        ? "bg-content text-content-inverse"
                        : "bg-canvas text-content"
                    }`}
                    aria-current={
                      activeSection === item.id ? "location" : undefined
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>
          ) : null}
        </header>

        <main className="mx-auto flex max-w-6xl flex-col gap-24 px-6 pb-28 pt-16">
          <section id="home" className="scroll-mt-32">
            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="text-center lg:text-start">
                <p className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface/80 px-4 py-1.5 text-xs font-semibold text-content-muted">
                  <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
                  ارائه‌های تعاملی برای کلاس‌ها، تیم‌ها و رویدادها
                </p>
                <h1 className="mt-6 text-4xl font-semibold leading-tight text-content md:text-6xl">
                  ارائه‌ای بسازید که مخاطب فقط تماشاگر آن نباشد
                </h1>
                <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-content-muted md:text-lg lg:mx-0">
                  اسلاید، سؤال، کوئیز و مشارکت زنده را در یک جریان واحد اجرا
                  کنید؛ بدون اینکه ارائه‌دهنده و شرکت‌کننده میان ابزارهای مختلف
                  سرگردان شوند.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                  <Link
                    to="/signup"
                    className="min-h-12 rounded-2xl bg-brand px-8 py-3 text-base font-semibold text-content-inverse shadow-panel transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    رایگان شروع کنید
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleScrollTo("features")}
                    className="min-h-12 rounded-2xl border border-border-subtle bg-surface px-8 py-3 text-base font-semibold text-content shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    دیدن ویژگی‌ها
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[32px] bg-brand-muted" />
                <div className="relative rounded-[32px] border border-border-subtle bg-surface p-6 shadow-panel">
                  <div className="flex items-center justify-between gap-4">
                    <span
                      className="text-xs font-semibold uppercase tracking-[0.24em] text-content-muted"
                      dir="ltr"
                    >
                      Live session
                    </span>
                    <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-ink">
                      آنلاین
                    </span>
                  </div>
                  <div className="mt-6 space-y-4">
                    {["نظرسنجی لحظه‌ای", "کوئیز پویا", "اسلاید مشارکتی"].map(
                      (item) => (
                        <div
                          key={item}
                          className="flex items-center justify-between rounded-2xl border border-border-subtle bg-canvas px-4 py-3"
                        >
                          <span className="text-sm font-semibold text-content">
                            {item}
                          </span>
                          <span
                            className="h-2 w-20 rounded-full bg-brand-border"
                            aria-hidden="true"
                          />
                        </div>
                      ),
                    )}
                  </div>
                  <div className="mt-6 rounded-2xl bg-content px-4 py-3 text-sm font-semibold leading-7 text-content-inverse">
                    پاسخ‌ها و نتیجه‌ها در جریان همان جلسه همگام می‌شوند.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="scroll-mt-32">
            <SectionHeader
              title="ابزارهای اصلی یک ارائه تعاملی"
              description="تمرکز محصول روی چرخه واقعی ارائه است: آماده‌سازی، اجرای زنده و مرور نتیجه."
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {FEATURE_LIST.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </section>

          <section id="how" className="scroll-mt-32">
            <div className="rounded-[40px] border border-border-subtle bg-surface/85 p-6 shadow-panel sm:p-10">
              <SectionHeader
                title="از ساخت تا نتیجه در سه مرحله"
                description="هر مرحله مالکیت مشخص دارد و مخاطب با یک کد ورود به جلسه متصل می‌شود."
              />
              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {STEP_LIST.map((step, index) => (
                  <StepCard key={step.title} index={index + 1} {...step} />
                ))}
              </div>
            </div>
          </section>

          <section id="audience" className="scroll-mt-32">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <SectionHeader
                  title="برای موقعیت‌های مختلف، با یک جریان آشنا"
                  description="از کلاس درس تا جلسه فروش، ساختار ورود و اجرای جلسه ثابت می‌ماند و محتوا متناسب با سناریوی شما تغییر می‌کند."
                />
                <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                  {USE_CASES.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm font-semibold text-content-muted shadow-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-[32px] border border-content/10 bg-content p-8 text-content-inverse shadow-panel">
                <h3 className="text-center text-2xl font-semibold">
                  آماده‌اید ارائه بعدی را تعاملی‌تر اجرا کنید؟
                </h3>
                <p className="mt-4 text-center text-sm leading-7 text-content-inverse/80">
                  حساب بسازید، ارائه را آماده کنید و کد ورود را با مخاطبان به
                  اشتراک بگذارید.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    to="/signup"
                    className="min-h-11 rounded-2xl bg-surface px-5 py-2.5 text-sm font-semibold text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    ایجاد حساب رایگان
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleScrollTo("home")}
                    className="min-h-11 rounded-2xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-content-inverse transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    بازگشت به بالا
                  </button>
                </div>
              </div>
            </div>
          </section>

          <p className="mt-4 text-center text-xs text-content-muted md:text-sm">
            ساخته‌شده توسط تیم ProSlides
            {" — "}
            <Link
              to="/team"
              className="rounded-md font-semibold text-content-muted transition-colors hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              آشنایی با تیم
            </Link>
          </p>
        </main>
      </div>
    </div>
  );
}
