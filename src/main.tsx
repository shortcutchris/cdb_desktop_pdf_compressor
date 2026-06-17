import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, detectThemePref } from "./theme";

// apply persisted/system theme before first paint to avoid a flash
applyTheme(detectThemePref());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
