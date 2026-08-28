export default function EditorRouteSkeleton() {
  return (
    <div
      className="min-h-screen bg-brand-soft text-content"
      dir="rtl"
      aria-busy="true"
      aria-label="در حال آماده‌سازی ویرایشگر"
    >
      <div className="h-16 border-b border-brand-border bg-surface px-4 shadow-sm md:px-6">
        <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-brand-muted motion-reduce:animate-none" />
          <div className="h-9 w-40 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />
        </div>
      </div>
      <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1600px] gap-4 p-4 md:grid-cols-[240px_minmax(0,1fr)] md:p-6">
        <aside className="hidden rounded-3xl border border-brand-border bg-surface p-4 shadow-sm md:block">
          <div className="mb-5 h-5 w-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          <div className="aspect-video animate-pulse rounded-2xl bg-brand-soft motion-reduce:animate-none" />
          <div className="mt-4 aspect-video animate-pulse rounded-2xl bg-slate-50 motion-reduce:animate-none" />
        </aside>
        <section className="flex min-h-[520px] items-center justify-center rounded-3xl border border-brand-border bg-surface p-6 shadow-sm">
          <div className="w-full max-w-xl text-center" role="status" aria-live="polite">
            <div className="mx-auto h-16 w-16 animate-pulse rounded-2xl bg-brand-muted motion-reduce:animate-none" />
            <p className="mt-5 text-lg font-bold">در حال آماده‌سازی ویرایشگر…</p>
            <p className="mt-2 text-sm text-slate-500">ساختار ارائه تا چند لحظه دیگر آماده است.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
