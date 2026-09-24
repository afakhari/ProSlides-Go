import EditorRouteSkeleton from "../../modules/presentations/editor/routes/EditorRouteSkeleton.tsx";

export default function InitialRouterFallback() {
  const pathname =
    typeof window === "undefined" ? "/" : window.location.pathname;

  if (/^\/manager\/panel\/[^/]+\/?$/.test(pathname)) {
    return <EditorRouteSkeleton />;
  }

  return (
    <div
      className="min-h-screen bg-canvas"
      aria-busy="true"
      aria-label="در حال بارگذاری صفحه"
    />
  );
}
