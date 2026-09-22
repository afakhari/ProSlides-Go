import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import AppQueryProvider from "./app/providers/AppQueryProvider.tsx";
const root = createRoot(document.getElementById("root"));

root.render(
  <AppQueryProvider>
    <App />
  </AppQueryProvider>
);

