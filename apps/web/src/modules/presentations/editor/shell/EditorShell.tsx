import type { ReactNode } from "react";

type EditorShellProps = {
  header: ReactNode;
  itemRail: ReactNode;
  canvas: ReactNode;
  topActions?: ReactNode;
  inspector?: ReactNode;
  toolbar: ReactNode;
  mobileItemRail?: ReactNode;
  isMobile: boolean;
  children?: ReactNode;
};

export default function EditorShell({
  header,
  itemRail,
  canvas,
  topActions,
  inspector,
  toolbar,
  mobileItemRail,
  isMobile,
  children,
}: EditorShellProps) {
  return (
    <div
      className="relative flex h-full flex-col bg-gradient-to-b from-brand-soft to-canvas pb-20 pt-16 text-content md:pb-0"
      dir="rtl"
      style={{ fontFamily: '"Vazirmatn", "Segoe UI", sans-serif' }}
      data-editor-shell="v2"
    >
      {header}

      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-3 md:flex-row md:p-4">
        {!isMobile && (
          <aside
            aria-label="فهرست آیتم‌ها"
            data-editor-region="item-rail"
            className="w-full max-h-[40vh] overflow-y-auto rounded-2xl border border-brand-border bg-surface p-4 shadow-sm md:h-full md:max-h-none md:w-1/4 lg:w-1/5"
          >
            {itemRail}
          </aside>
        )}

        <main
          className="relative flex-1"
          data-editor-region="canvas"
          aria-label="بوم ویرایش"
        >
          <div className="relative flex h-full min-h-[520px] items-center justify-center overflow-hidden rounded-3xl border border-brand-border bg-surface p-3 shadow-sm">
            {topActions && (
              <div
                className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-3"
                data-editor-region="top-actions"
              >
                {topActions}
              </div>
            )}
            {canvas}
          </div>
        </main>

        {inspector && (
          <section
            aria-label="بازرس آیتم"
            data-editor-region="inspector"
            className="fixed inset-x-0 bottom-0 top-14 z-50 w-full overflow-y-auto rounded-xl border border-border-subtle bg-surface p-4 shadow-panel md:static md:h-full md:w-1/3 lg:w-1/4"
            style={
              isMobile
                ? {
                    top: "calc(3.5rem + env(safe-area-inset-top))",
                    maxHeight: "none",
                  }
                : undefined
            }
          >
            {inspector}
          </section>
        )}

        {toolbar}
      </div>

      {mobileItemRail}
      {children}
    </div>
  );
}
