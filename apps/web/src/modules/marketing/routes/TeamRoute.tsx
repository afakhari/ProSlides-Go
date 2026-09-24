import { useLayoutEffect } from "react";

import alirezaRezaei from "../../../assets/avatars/AlirezaRezaei.jpg";
import amiraliFakhari from "../../../assets/avatars/AmiraliFakhari.jpg";
import aminBidad from "../../../assets/avatars/AminBidad.jpg";
import HesamAzmoun from "../../../assets/avatars/HesamAzmoun.jpg";
import KianJanbozorgi from "../../../assets/avatars/KianJanbozorgi.jpg";
import SimaKazemi from "../../../assets/avatars/SimaKazemi.jpg";
import ZahraKefayati from "../../../assets/avatars/ZahraKefayati.jpg";
import dotGrid from "../../../assets/patterns/dot-grid.svg";
import Seo from "../../../shared/ui/Seo.tsx";
import SiteHeader from "../../../shared/ui/SiteHeader.tsx";

type TeamMember = {
  name: string;
  role: string;
  description: string;
  avatar: string;
  coverClassName: string;
  ringClassName: string;
  badgeClassName: string;
};

const backendTeam: TeamMember[] = [
  {
    name: "امین بیداد",
    role: "مهندسی بک‌اند · توسعه اولیه Rust",
    description:
      "در توسعه زیرساخت و سرویس‌های بلادرنگ اولیه پروژه با Rust نقش داشته است؛ بخشی از مسیری که بعداً در معماری فعلی Go بازطراحی شد.",
    avatar: aminBidad,
    coverClassName: "bg-info-soft",
    ringClassName: "bg-info-border",
    badgeClassName: "bg-info-soft text-info-ink",
  },
  {
    name: "امیرعلی فخاری",
    role: "مهندسی بک‌اند · توسعه اولیه Django",
    description:
      "در توسعه بک‌اند اولیه مبتنی بر Django/DRF، مدل‌های داده و APIهای محصول نقش داشته است؛ این سابقه پیش از مهاجرت backend فعلی به Go است.",
    avatar: amiraliFakhari,
    coverClassName: "bg-brand-soft",
    ringClassName: "bg-brand-border",
    badgeClassName: "bg-brand-soft text-brand-ink",
  },
];

const frontendTeam: TeamMember[] = [
  {
    name: "علیرضا رضایی",
    role: "مهندسی فرانت‌اند · React",
    description:
      "روی پیاده‌سازی رابط‌های محصول و یکپارچگی تجربه کاربری در مسیرهای اصلی کار کرده است.",
    avatar: alirezaRezaei,
    coverClassName: "bg-success-soft",
    ringClassName: "bg-success-border",
    badgeClassName: "bg-success-soft text-success-ink",
  },
  {
    name: "حسام آزمون",
    role: "مهندسی فرانت‌اند · React",
    description:
      "در تبدیل جریان‌های محصول به تعامل‌های قابل‌فهم و روان در رابط کاربری مشارکت داشته است.",
    avatar: HesamAzmoun,
    coverClassName: "bg-success-soft",
    ringClassName: "bg-success-border",
    badgeClassName: "bg-success-soft text-success-ink",
  },
  {
    name: "کیان جان بزرگی",
    role: "مهندسی فرانت‌اند · React",
    description:
      "در توسعه مسیرهای فرانت‌اند و اتصال تجربه ارائه به قابلیت‌های محصول مشارکت داشته است.",
    avatar: KianJanbozorgi,
    coverClassName: "bg-success-soft",
    ringClassName: "bg-success-border",
    badgeClassName: "bg-success-soft text-success-ink",
  },
  {
    name: "سیما کاظمی",
    role: "مهندسی فرانت‌اند · React",
    description:
      "در توسعه و اصلاح رابط‌های ارائه و تجربه کاربری بخش‌های تعاملی محصول مشارکت داشته است.",
    avatar: SimaKazemi,
    coverClassName: "bg-success-soft",
    ringClassName: "bg-success-border",
    badgeClassName: "bg-success-soft text-success-ink",
  },
  {
    name: "زهرا کفایتی",
    role: "مهندسی فرانت‌اند · React",
    description:
      "در توسعه رابط کاربری و پرداخت جزئیات تجربه بصری و تعاملات فرانت‌اند مشارکت داشته است.",
    avatar: ZahraKefayati,
    coverClassName: "bg-success-soft",
    ringClassName: "bg-success-border",
    badgeClassName: "bg-success-soft text-success-ink",
  },
];

function TeamSection({
  id,
  title,
  description,
  members,
  gridClassName,
}: {
  id: string;
  title: string;
  description: string;
  members: TeamMember[];
  gridClassName: string;
}) {
  return (
    <section aria-labelledby={id} className="space-y-8">
      <div className="space-y-2">
        <h2 id={id} className="text-2xl font-semibold text-content">
          {title}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-content-muted">
          {description}
        </p>
      </div>

      <ul className={gridClassName}>
        {members.map((member) => (
          <li key={member.name}>
            <article className="group relative flex h-full min-h-[340px] flex-col overflow-hidden rounded-[28px] border border-border-subtle bg-surface text-center shadow-panel transition-transform duration-300 hover:-translate-y-1">
              <div
                className={`relative h-28 w-full overflow-hidden ${member.coverClassName}`}
                aria-hidden="true"
              >
                <div className="absolute -top-10 start-6 h-20 w-20 rounded-full bg-surface/60 blur-2xl" />
                <div className="absolute -bottom-10 end-6 h-24 w-24 rounded-full bg-surface/45 blur-2xl" />
              </div>

              <div className="relative flex flex-1 flex-col items-center px-6 pb-8">
                <div className="-mt-10 rounded-full bg-surface p-1 shadow-panel">
                  <div className={`rounded-full p-[3px] ${member.ringClassName}`}>
                    <div className="rounded-full bg-surface p-[3px]">
                      <img
                        src={member.avatar}
                        alt={`تصویر ${member.name}`}
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                        className="h-24 w-24 rounded-full object-cover"
                      />
                    </div>
                  </div>
                </div>

                <h3 className="mt-4 text-lg font-semibold text-content">
                  {member.name}
                </h3>
                <span
                  className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${member.badgeClassName}`}
                >
                  {member.role}
                </span>
                <p className="mt-3 text-sm leading-7 text-content-muted">
                  {member.description}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TeamRoute() {
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <main
      className="relative min-h-screen overflow-x-hidden bg-canvas text-content"
      dir="rtl"
      style={{
        backgroundImage: `url(${dotGrid})`,
        backgroundSize: "56px 56px",
      }}
    >
      <Seo
        title="تیم ما | پرو اسلایدز"
        description="با اعضای تیم ProSlides و نقش آن‌ها در توسعه مسیرهای فرانت‌اند، Django و Rust اولیه و معماری فعلی محصول آشنا شوید."
        canonical="https://proslides.ir/team"
      />

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-28 -start-24 h-72 w-72 rounded-full bg-info-soft/80 blur-3xl" />
        <div className="absolute top-20 -end-32 h-80 w-80 rounded-full bg-brand-soft/75 blur-3xl" />
        <div className="absolute bottom-0 start-1/3 h-80 w-80 rounded-full bg-success-soft/80 blur-3xl" />
      </div>

      <SiteHeader className="relative z-10" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16 sm:py-20">
        <header className="mx-auto max-w-3xl space-y-4 pb-4 text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.24em] text-content-muted"
            dir="ltr"
          >
            ProSlides team
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-content sm:text-5xl">
            تیم ما
          </h1>
          <p className="text-base leading-8 text-content-muted sm:text-lg">
            ProSlides در چند نسل فنی توسعه پیدا کرده است. صفحه تیم نقش‌های واقعی
            اعضا در آن مسیر را حفظ می‌کند، حتی اگر فناوری فعلی محصول نسبت به
            نسخه‌های اولیه تغییر کرده باشد.
          </p>
        </header>

        <aside className="rounded-3xl border border-brand-border bg-brand-soft p-5 text-sm leading-7 text-brand-ink sm:p-6">
          <strong className="font-semibold">درباره فناوری‌های بک‌اند:</strong>{" "}
          اشاره به Rust و Django در کارت اعضای بک‌اند، سابقه توسعه اولیه محصول
          است. معماری backend فعال ProSlides اکنون بر Go استوار است؛ بنابراین
          این برچسب‌ها تاریخچه مشارکت اعضا را نشان می‌دهند، نه stack فعلی
          production.
        </aside>

        <TeamSection
          id="backend-team"
          title="مهندسی بک‌اند"
          description="توسعه بک‌اند ProSlides از Django و سرویس‌های Rust اولیه عبور کرده و امروز به معماری Go رسیده است. این بخش نقش اعضا در مراحل اولیه را با همان زمینه تاریخی نمایش می‌دهد."
          members={backendTeam}
          gridClassName="grid gap-8 md:grid-cols-2"
        />

        <TeamSection
          id="frontend-team"
          title="مهندسی فرانت‌اند"
          description="اعضای فرانت‌اند در توسعه رابط‌های React و تجربه تعاملی ارائه‌دهنده و شرکت‌کننده مشارکت داشته‌اند."
          members={frontendTeam}
          gridClassName="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        />
      </div>
    </main>
  );
}
