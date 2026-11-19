import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";

import { store } from "./app/store";
import { logout } from "./features/auth/authSlice";
import { setUnauthorizedHandler } from "./services/api";
import App from "./App";

import "./index.css";

// টোকেন মেয়াদোত্তীর্ণ হলে অটো লগআউট → ProtectedRoute /login এ পাঠাবে
setUnauthorizedHandler(() => store.dispatch(logout()));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
