// client/src/App.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import ThemeToggle from "./components/ThemeToggle.jsx";
import "./styles.css";

export default function App() {
  return (
    <div>
      <header className="app-header">
        <div className="header-inner container-max">
          <div className="brand">CodeCollab</div>
          <ThemeToggle />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
