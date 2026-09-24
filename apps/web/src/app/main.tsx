import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import AppQueryProvider from "./providers/AppQueryProvider.tsx";
import InitialRouterFallback from "./router/InitialRouterFallback.tsx";
import { appRouter } from "./router/router.tsx";
import "../index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <AppQueryProvider>
    <RouterProvider
      router={appRouter}
      fallbackElement={<InitialRouterFallback />}
    />
  </AppQueryProvider>,
);
