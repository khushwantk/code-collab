import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";

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

  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState("vs-dark");

  const isDark = theme === "vs-dark";
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
  const setAwareness = (patch) => {
    const aw = providerRef.current?.awareness;
    if (!aw) return;
    const currentToolbarState = aw.getLocalState()?.toolbar || {};
    aw.setLocalStateField("toolbar", { ...currentToolbarState, ...patch });
  };

  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl =
      (import.meta.env.VITE_YWS_URL || "ws://localhost:1234") + `/${docId}`;
    const provider = new WebsocketProvider(wsUrl, docId, ydoc);
    providerRef.current = provider;

    const ytext = ydoc.getText("monaco");
    const meta = ydoc.getMap("meta"); // We will use this for language sync

    // ... (doSeedOnce function and its logic is the same)
    function doSeedOnce() {
      ydoc.transact(() => {
        const alreadySeeded = meta.get("seeded") === true;
        const isEmpty = ytext.toString().length === 0;
        if (!alreadySeeded && isEmpty) {
          ytext.insert(
            0,
            `\n  // Welcome to CodeCollab!\n  // This is a collaborative editor.\n  // Start typing below...\n\n  function hello() {\n    console.log("Hello world!");\n  }\n\n  hello();`
          );
          meta.set("seeded", true);
        }
      });
    }

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
      // ... (editor options are the same)
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

    if (me) {
      const userColor = getRandomColor();
      provider.awareness.setLocalStateField("user", {
        name: me.name,
        color: userColor,
        colorLight: "#FFFFFF",
      });
      console.log(
        "✅ My Local Awareness State Set:",
        provider.awareness.getLocalState()
      );
    }

    provider.awareness.on("update", () => {
      // getStates() returns a Map of all users' awareness states
      const states = provider.awareness.getStates();
      console.log("📡 Awareness update received. All states:", states);
    });

    // Set initial toolbar state for others (non-conflicting)
    setAwareness({ language, theme });

    // Sync language using the Y.Map
    const onMetaChange = (event) => {
      if (event.keysChanged.has("language")) {
        const newLang = meta.get("language");
        if (newLang && newLang !== language) {
          setLanguage(newLang);
        }
      }
    };

    // Set initial language from shared state if it exists
    const initialLang = meta.get("language");
    if (initialLang) {
      setLanguage(initialLang);
    }

    meta.observe(onMetaChange);

    return () => {
      meta.unobserve(onMetaChange);

      binding.destroy();
      editor.dispose();
      provider.destroy();
      ydoc.destroy();
    };
  }, [docId, me]);

  // When local language changes, apply + BROADCAST to Y.Map
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    monaco.editor.setModelLanguage(ed.getModel(), language);

    // Write the new language to the shared map
    const meta = providerRef.current?.doc.getMap("meta");
    if (meta) {
      meta.set("language", language);
    }

    // Still update awareness for non-critical UI hints
    setAwareness({ language });
  }, [language]);

  // When local theme changes, apply + broadcast
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

// ... (extFor function is the same)
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
