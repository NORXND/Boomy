import { createRoot } from "react-dom/client";
import "./index.css";
import React, { StrictMode } from "react";
import { App } from "./app/App";

const root = createRoot(document.getElementById("app"));
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
