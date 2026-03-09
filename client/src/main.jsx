import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { UserProvider } from "./experience/UserContext.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <UserProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </UserProvider>
    </BrowserRouter>
  </React.StrictMode>
);
