import { Outlet, useNavigation } from "react-router-dom";

function NavigationProgress() {
  const navigation = useNavigation();
  if (navigation.state === "idle") return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[130] h-1 overflow-hidden bg-brand-soft"
      role="status"
      aria-live="polite"
      aria-label="در حال بارگذاری صفحه"
    >
      <div className="h-full w-1/3 animate-pulse bg-brand motion-reduce:animate-none" />
    </div>
  );
}

export default function AppRoot() {
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  );
}
