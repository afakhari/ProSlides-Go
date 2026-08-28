export const fa = {
  managerShell: {
    loadingDashboard: "در حال آماده‌سازی فضای ارائه‌ها…",
    routeErrorTitle: "این بخش از مدیریت ارائه بارگذاری نشد",
    routeErrorBody: "اطلاعات شما حفظ شده است. دوباره تلاش کنید یا به فهرست ارائه‌ها برگردید.",
    retry: "تلاش دوباره",
    backToDashboard: "بازگشت به ارائه‌ها",
    sessionExpired: "نشست شما منقضی شده است. برای ادامه دوباره وارد شوید.",
  },
  dashboard: {
    eyebrow: "فضای کاری شما",
    title: "ارائه‌های من",
    newPresentation: "ارائه جدید",
    createFirstPresentation: "ساخت اولین ارائه",
  },
  editor: {
    untitledPresentation: "ارائه بدون عنوان",
    share: "اشتراک‌گذاری",
    openShare: "تنظیم یا اشتراک‌گذاری کد ورود",
  },
  share: {
    title: "اشتراک‌گذاری ارائه",
    inviteAudience: "دعوت از مخاطبان",
    close: "بستن پنجره اشتراک‌گذاری",
  },
} as const;

export type PersianMessages = typeof fa;
