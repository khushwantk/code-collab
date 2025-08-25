import { Outlet, Link } from "react-router-dom";
import React from "react";

export default function App() {
  return (
    <div className="app">
      <header style={{ padding: 12, borderBottom: "1px solid #333" }}>
        <Link
          to="/"
          style={{ color: "white", textDecoration: "none", fontWeight: 700 }}
        >
          code-collab
        </Link>
      </header>
      <main style={{ padding: 12 }}>
        <Outlet />
      </main>
    </div>
  );
}
