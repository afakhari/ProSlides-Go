import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router-dom";

import ProtectedManagerShell from "../layouts/ProtectedManagerShell.tsx";
import AppRoot from "./AppRoot.tsx";
import {
  AppRouteErrorBoundary,
  ManagerRouteErrorBoundary,
} from "./RouteErrorBoundary.tsx";
import { requireManagerSession } from "./managerSessionLoader.ts";

type DefaultComponentModule = {
  default: ComponentType;
};

const lazyComponent =
  (load: () => Promise<DefaultComponentModule>) =>
  async () => ({
    Component: (await load()).default,
  });

const lazyPresentationEntry = (
  mode: "presentation" | "accessCode",
  role?: "manager" | "player",
) => async () => {
  const { default: PresentationEntry } = await import(
    "../../modules/live/routes/PresentationEntry.tsx"
  );

  return {
    Component: () => <PresentationEntry mode={mode} role={role} />,
  };
};

export const appRouter = createBrowserRouter([
  {
    path: "/",
    Component: AppRoot,
    ErrorBoundary: AppRouteErrorBoundary,
    children: [
      {
        index: true,
        lazy: lazyComponent(() => import("../../pages/landing/LandingPage.jsx")),
      },
      {
        path: "team",
        lazy: lazyComponent(() => import("../../pages/team/TeamPage.jsx")),
      },
      {
        path: "login",
        lazy: lazyComponent(() => import("../../modules/identity/routes/AuthRoute.tsx")),
      },
      {
        path: "signup",
        lazy: lazyComponent(() => import("../../modules/identity/routes/AuthRoute.tsx")),
      },
      {
        path: "auth",
        lazy: lazyComponent(() => import("../../modules/identity/routes/AuthRoute.tsx")),
      },
      {
        path: "reset-password",
        lazy: lazyComponent(() =>
          import("../../modules/identity/routes/ResetPasswordRoute.tsx"),
        ),
      },
      {
        path: "manager/presentation/:roomId",
        loader: requireManagerSession,
        ErrorBoundary: ManagerRouteErrorBoundary,
        lazy: lazyPresentationEntry("presentation", "manager"),
      },
      {
        path: "player/presentation/:roomId",
        lazy: lazyPresentationEntry("presentation", "player"),
      },
      {
        Component: ProtectedManagerShell,
        loader: requireManagerSession,
        ErrorBoundary: ManagerRouteErrorBoundary,
        children: [
          {
            path: "manager/panel",
            lazy: lazyComponent(() =>
              import("../../pages/quiz/manager/HomePage.jsx"),
            ),
          },
          {
            path: "manager/panel/:roomId",
            lazy: lazyComponent(() =>
              import("../../modules/presentations/editor/routes/EditorRoute.tsx"),
            ),
          },
          {
            path: "manager/panel/:presentationId/report",
            lazy: lazyComponent(() =>
              import("../../modules/reports/routes/ReportRoute.tsx"),
            ),
          },
        ],
      },
      {
        path: ":accessCode",
        lazy: lazyPresentationEntry("accessCode"),
      },
      {
        path: "*",
        lazy: lazyComponent(() => import("./NotFoundRoute.tsx")),
      },
    ],
  },
]);
