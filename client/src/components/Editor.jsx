import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

// Configure Monaco to use ESM web workers under Vite.
if (typeof window !== "undefined" && !window.MonacoEnvironment) {
  window.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      if (label === "json") {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/json/json.worker?worker",
            import.meta.url
          ),
          { type: "module" }
        );
      }
      if (label === "css" || label === "scss" || label === "less") {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/css/css.worker?worker",
            import.meta.url
          ),
          { type: "module" }
        );
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/html/html.worker?worker",
            import.meta.url
          ),
          { type: "module" }
        );
      }
      if (label === "typescript" || label === "javascript") {
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/typescript/ts.worker?worker",
            import.meta.url
          ),
          { type: "module" }
        );
      }
      return new Worker(
        new URL(
          "monaco-editor/esm/vs/editor/editor.worker?worker",
          import.meta.url
        ),
        { type: "module" }
      );
    },
  };
}

const USER_COLORS = [
  "#ff6666",
  "#66ff66",
  "#6666ff",
  "#ffff66",
  "#ff66ff",
  "#66ffff",
];
const getRandomColor = () =>
  USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

const LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "cpp", label: "C/C++" },
  { id: "java", label: "Java" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "markdown", label: "Markdown" },
];

export default function Editor({ docId, me }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);
  const userColorRef = useRef(getRandomColor());

  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState(() => {
    // initialize from HTML data attribute if available
    const rootTheme = document.documentElement.getAttribute("data-theme") || "dark";
    return rootTheme === "dark" ? "vs-dark" : "vs";
  });
  const isDark = theme === "vs-dark";

  // listen to global theme change
  useEffect(() => {
    const onThemeChange = (e) => {
      const globalTheme = e.detail?.theme;
      if (globalTheme) {
        setTheme(globalTheme === "dark" ? "vs-dark" : "vs");
      }
    };
    window.addEventListener("themechange", onThemeChange);
    return () => window.removeEventListener("themechange", onThemeChange);
  }, []);

  const toolbarStyle = useMemo(
    () => ({
      display: "flex",
      gap: 8,
      alignItems: "center",
      padding: 8,
      borderBottom: `1px solid ${isDark ? "#1f2430" : "#e6e6ef"}`,
      background: isDark ? "#0f0f14" : "#f8f9fe",
    }),
    [isDark]
  );

  const buttonStyle = useMemo(
    () => ({
      padding: "8px 12px",
      borderRadius: 8,
      border: `1px solid ${isDark ? "#2a2f3a" : "#d7d9e3"}`,
      background: isDark ? "#1a1f2a" : "#ffffff",
      color: isDark ? "#eaeaf0" : "#0a0a0a",
      cursor: "pointer",
      fontWeight: 600,
    }),
    [isDark]
  );

  const selectStyle = useMemo(
    () => ({
      padding: "6px 10px",
      borderRadius: 8,
      border: `1px solid ${isDark ? "#2a2f3a" : "#d7d9e3"}`,
      background: isDark ? "#1a1f2a" : "#ffffff",
      color: isDark ? "#eaeaf0" : "#0a0a0a",
    }),
    [isDark]
  );

  // ---- helpers ----
  const setAwareness = (patch) => {
    const aw = providerRef.current?.awareness;
    if (!aw) return;
    const cur = aw.getLocalState()?.toolbar || {};
    aw.setLocalStateField("toolbar", { ...cur, ...patch });
  };

  const setUserInAwareness = (name) => {
    const aw = providerRef.current?.awareness;
    if (!aw) return;
    const prev = aw.getLocalState() || {};
    aw.setLocalState({
      ...prev,
      user: {
        color: prev.user?.color || userColorRef.current,
        colorLight: "#FFFFFF",
        name: name || prev.user?.name || "Guest",
      },
    });
  };

  const applyRemoteLabels = () => {
    const aw = providerRef.current?.awareness;
    const root = containerRef.current;
    if (!aw || !root) return;

    for (const [clientId, state] of aw.getStates()) {
      const name = state?.user?.name || "Guest";
      const color = state?.user?.color || "#888";

      root
        .querySelectorAll(`.yRemoteSelectionHead-${clientId}`)
        .forEach((el) => {
          el.setAttribute("data-name", name);
          if (!el.style.borderLeftColor) el.style.borderLeftColor = color;
        });

      root.querySelectorAll(`.yRemoteSelection-${clientId}`).forEach((el) => {
        if (!el.style.backgroundColor) el.style.backgroundColor = `${color}40`;
      });
    }
  };

  // reflect me->awareness whenever me changes
  useEffect(() => {
    if (!providerRef.current) return;
    setUserInAwareness(me?.name);
    applyRemoteLabels();
  }, [me]);

  // main setup
  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsBase = import.meta.env.VITE_YWS_URL || "ws://localhost:1234";
    // y-websocket's WebsocketProvider takes a base URL and a room name.
    // It appends `/${roomName}` internally, so we must *not* add the docId
    // to the base URL here, otherwise we'd end up with /docId/docId.
    const provider = new WebsocketProvider(wsBase, docId, ydoc);
    providerRef.current = provider;

    const ytext = ydoc.getText("monaco");
    const meta = ydoc.getMap("meta");

    // one-time seeding (post-sync), guarded with shared flag
    const doSeedOnce = () => {
      ydoc.transact(() => {
        const alreadySeeded = meta.get("seeded") === true;
        const isEmpty = ytext.toString().length === 0;
        if (!alreadySeeded && isEmpty) {
          ytext.insert(
            0,
            `// Welcome to CodeCollab!
  // This is a collaborative editor.
  // Start typing below...

  function hello() {
    console.log("Hello world!");
  }

  hello();`
          );
          meta.set("seeded", true);
        }
      });
    };

    if (typeof provider.whenSynced?.then === "function") {
      provider.whenSynced.then(doSeedOnce);
    } else {
      const onSynced = (isSynced) => {
        if (isSynced) {
          doSeedOnce();
          provider.off?.("synced", onSynced);
        }
      };
      provider.on?.("synced", onSynced);
      setTimeout(() => {
        if (!meta.get("seeded")) doSeedOnce();
      }, 800);
    }

    const editor = monaco.editor.create(containerRef.current, {
      value: "",
      language,
      theme,
      automaticLayout: true,
      lineNumbers: "on",
      minimap: { enabled: true },
      wordWrap: "off",
      tabSize: 2,
      insertSpaces: true,
      fontSize: 14,
      fontLigatures: true,
      cursorBlinking: "smooth",
      smoothScrolling: true,
      autoClosingBrackets: "languageDefined",
      autoClosingQuotes: "languageDefined",
      formatOnType: false,
      formatOnPaste: false,
    });
    editorRef.current = editor;

    const binding = new MonacoBinding(
      ytext,
      editor.getModel(),
      new Set([editor]),
      provider.awareness
    );
    bindingRef.current = binding;

    // set local user (works even if me is undefined; later effect updates name)
    setUserInAwareness(me?.name);
    // initial labels
    applyRemoteLabels();

    // relay labels on awareness updates
    provider.awareness.on("update", applyRemoteLabels);

    // initial toolbar state (non-conflicting)
    setAwareness({ language, theme });

    // language sync via meta map
    const onMetaChange = (event) => {
      if (event.keysChanged.has("language")) {
        const newLang = meta.get("language");
        if (newLang && newLang !== language) setLanguage(newLang);
      }
    };
    const initialLang = meta.get("language");
    if (initialLang) setLanguage(initialLang);
    meta.observe(onMetaChange);

    return () => {
      provider.awareness.off?.("update", applyRemoteLabels);
      meta.unobserve(onMetaChange);
      binding.destroy();
      editor.dispose();
      provider.destroy();
      ydoc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // language change -> apply + broadcast
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    monaco.editor.setModelLanguage(ed.getModel(), language);

    const meta = providerRef.current?.doc.getMap("meta");
    if (meta) meta.set("language", language);

    setAwareness({ language });
  }, [language]);

  // theme change -> apply + broadcast (editor-local theme)
  useEffect(() => {
    monaco.editor.setTheme(theme);
    setAwareness({ theme });
  }, [theme]);

  const downloadCode = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const value = editor.getModel().getValue();
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${docId}.${extFor(language)}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div
      style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%" }}
    >
      <div style={toolbarStyle}>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={selectStyle}
          title="Language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        <div style={{ marginLeft: "auto" }} />

        <button
          onClick={() => setTheme(isDark ? "vs" : "vs-dark")}
          style={buttonStyle}
          title="Toggle editor theme (independent of app)"
        >
          {isDark ? "Light theme" : "Dark theme"}
        </button>

        <button
          onClick={downloadCode}
          style={buttonStyle}
          title="Download current buffer"
        >
          Download
        </button>
      </div>

      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

function extFor(lang) {
  switch (lang) {
    case "javascript":
      return "js";
    case "typescript":
      return "ts";
    case "python":
      return "py";
    case "cpp":
      return "cpp";
    case "java":
      return "java";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "markdown":
      return "md";
    default:
      return "txt";
  }
}
