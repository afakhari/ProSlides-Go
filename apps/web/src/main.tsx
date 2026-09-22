import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import AppQueryProvider from "./app/providers/AppQueryProvider.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <AppQueryProvider>
    <App />
  </AppQueryProvider>,
);
