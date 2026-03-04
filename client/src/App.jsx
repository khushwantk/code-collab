// client/src/App.jsx
import React from "react";
import { Outlet, Link } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ThemeToggle from "./components/ThemeToggle.jsx";
import "./styles.css";

export default function App() {
  return (
    <div>
      <Toaster position="top-center" />
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>CodeCollab</Link>
          <ThemeToggle />
        </div>
      </header>
      <Outlet />
    </div>
  );
}
