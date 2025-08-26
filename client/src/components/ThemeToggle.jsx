import React, { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    // broadcast to the whole app (Editor listens to this)
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  }, [theme]);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button className="btn btn--ghost btn--sm" onClick={() => setTheme(next)}>
      {theme === "dark" ? "🌙 Dark" : "🌞 Light"}
    </button>
  );
}
