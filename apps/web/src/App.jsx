import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation, useParams } from "react-router-dom";
import ProtectedManagerShell from "./app/layouts/ProtectedManagerShell";
import NotFoundRoute from "./app/router/NotFoundRoute";
import RequireSession from "./components/RequireSession.tsx";
import EditorRouteSkeleton from "./modules/presentations/editor/routes/EditorRouteSkeleton";
import LandingPage from "./pages/landing/LandingPage";

const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const TeamPage = lazy(() => import("./pages/team/TeamPage"));
const SessionDetail = lazy(() => import("./pages/report/SessionDetail"));
const HomePage = lazy(() => import("./pages/quiz/manager/HomePage"));
const EditorPage = lazy(() => import("./modules/presentations/editor/routes/EditorRoute"));
const PresentationEntry = lazy(() => import("./routes/PresentationEntry"));

function RouteFallback() {
  const location = useLocation();
  if (/^\/[^/]+\/panel\/[^/]+\/?$/.test(location.pathname)) return <EditorRouteSkeleton />;
  return <div className="min-h-screen bg-white" aria-busy="true" aria-label="در حال بارگذاری صفحه" />;
}

function ProtectedPresentationRoute() {
  const { role } = useParams();
  const presentation = <PresentationEntry mode="presentation" />;
  return role === "manager" ? <RequireSession>{presentation}</RequireSession> : presentation;
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
          <Route path="/:role/presentation/:roomId" element={<ProtectedPresentationRoute />} />
          <Route element={<ProtectedManagerShell />}>
            <Route path="/:role/panel" element={<HomePage />} />
            <Route path="/:role/panel/:roomId" element={<EditorPage />} />
          </Route>
          <Route path="/:role/panel/:quizId/report" element={<RequireSession><SessionDetail /></RequireSession>} />
          <Route path="/:accessCode" element={<PresentationEntry mode="accessCode" />} />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
