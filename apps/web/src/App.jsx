import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import ProtectedManagerShell from "./app/layouts/ProtectedManagerShell";
import NotFoundRoute from "./app/router/NotFoundRoute";
import RequireSession from "./components/RequireSession.tsx";
import EditorRouteSkeleton from "./modules/presentations/editor/routes/EditorRouteSkeleton";
import LandingPage from "./pages/landing/LandingPage";

const AuthPage = lazy(() => import("./modules/identity/routes/AuthRoute"));
const ResetPasswordPage = lazy(() => import("./modules/identity/routes/ResetPasswordRoute.tsx"));
const TeamPage = lazy(() => import("./pages/team/TeamPage"));
const ReportRoute = lazy(() => import("./modules/reports/routes/ReportRoute.tsx"));
const HomePage = lazy(() => import("./pages/quiz/manager/HomePage"));
const EditorPage = lazy(() => import("./modules/presentations/editor/routes/EditorRoute"));
const PresentationEntry = lazy(() => import("./routes/PresentationEntry"));

function RouteFallback() {
  const location = useLocation();
  if (/^\/[^/]+\/panel\/[^/]+\/?$/.test(location.pathname)) return <EditorRouteSkeleton />;
  return <div className="min-h-screen bg-white" aria-busy="true" aria-label="در حال بارگذاری صفحه" />;
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/manager/presentation/:roomId"
            element={<RequireSession><PresentationEntry mode="presentation" role="manager" /></RequireSession>}
          />
          <Route
            path="/player/presentation/:roomId"
            element={<PresentationEntry mode="presentation" role="player" />}
          />
          <Route element={<ProtectedManagerShell />}>
            <Route path="/manager/panel" element={<HomePage />} />
            <Route path="/manager/panel/:roomId" element={<EditorPage />} />
            <Route path="/manager/panel/:presentationId/report" element={<ReportRoute />} />
          </Route>
          <Route path="/:accessCode" element={<PresentationEntry mode="accessCode" />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
