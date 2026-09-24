import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { fa } from "../../shared/i18n/fa.ts";
import Notice from "../../shared/ui/Notice.tsx";

export default function ProtectedManagerShell() {
  const [appNotice, setAppNotice] = useState<string | null>(null);

  useEffect(() => {
    const handleNotice = (event: Event) => {
      const code = (event as CustomEvent<{ code?: string }>).detail?.code;
      if (code === "session-expired" || code === "session-revoked") {
        setAppNotice(fa.managerShell.sessionExpired);
      }
    };

    window.addEventListener("app:notice", handleNotice);
    return () => window.removeEventListener("app:notice", handleNotice);
  }, []);

  return (
    <div data-manager-shell="protected" className="min-h-screen bg-canvas">
      {appNotice && (
        <div
          className="fixed inset-x-4 top-4 z-[120] mx-auto max-w-xl"
          dir="rtl"
        >
          <Notice tone="warning">{appNotice}</Notice>
        </div>
      )}
      <Outlet />
    </div>
  );
}
