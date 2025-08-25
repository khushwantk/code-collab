import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import * as monaco from "monaco-editor";

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

export default function Editor({ docId }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const providerRef = useRef(null);
  const bindingRef = useRef(null);

  // Editor-local (independent of app theme and other peers)
  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState("vs-dark"); // "vs" (light) | "vs-dark" (dark)

  const isDark = theme === "vs-dark";

  // Toolbar visuals keyed to editor theme (not app theme)
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

  // Helper to broadcast only (we won't apply remote theme back)
  const setAwareness = (patch) => {
    const aw = providerRef.current?.awareness;
    if (!aw) return;
    const me = aw.getLocalState() || {};
    aw.setLocalState({ ...me, toolbar: { ...(me.toolbar || {}), ...patch } });
  };

  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsUrl =
      (import.meta.env.VITE_YWS_URL || "ws://localhost:1234") + `/${docId}`;
    const provider = new WebsocketProvider(wsUrl, docId, ydoc);
    providerRef.current = provider;

    const ytext = ydoc.getText("monaco");

    const meta = ydoc.getMap("meta");

    function doSeedOnce() {
      // Seed only if the shared doc is genuinely empty and not already seeded
      ydoc.transact(() => {
        const alreadySeeded = meta.get("seeded") === true;
        const isEmpty = ytext.toString().length === 0;
        if (!alreadySeeded && isEmpty) {
          ytext.insert(
            0,
            `
  // Welcome to CodeCollab!
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
    }

    // Prefer a post-sync hook if available, otherwise fall back
    if (typeof provider.whenSynced?.then === "function") {
      provider.whenSynced.then(doSeedOnce);
    } else {
      // y-websocket classic: use the 'synced' flag/event
      if (provider.synced) {
        doSeedOnce();
      } else {
        const onSynced = (isSynced) => {
          if (isSynced) {
            doSeedOnce();
            provider.off?.("synced", onSynced); // clean up if off() exists
          }
        };
        provider.on?.("synced", onSynced);
        // tiny safety net if the event API isn’t present
        setTimeout(() => {
          if (!meta.get("seeded")) doSeedOnce();
        }, 800);
      }
    }
    const editor = monaco.editor.create(containerRef.current, {
      value: "",
      language,
      theme, // editor-local theme
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

    // Seed initial toolbar state for others to see (broadcast only)
    provider.awareness.setLocalStateField("toolbar", { language, theme });

    // Apply ONLY language updates from others (if you want shared language)
    const onAwarenessChange = () => {
      const aw = provider.awareness;
      if (!aw) return;
      const myId = aw.clientID;
      // Iterate remote states only
      for (const [clientId, state] of aw.getStates()) {
        if (clientId === myId) continue; // ignore my own state
        const t = state?.toolbar;
        if (!t) continue;

        // If you want language to sync across participants, keep this:
        if (t.language && t.language !== language) {
          setLanguage(t.language);
          const ed = editorRef.current;
          if (ed) monaco.editor.setModelLanguage(ed.getModel(), t.language);
        }

        // IMPORTANT: do NOT apply remote theme back. We keep editor theme independent.
        // if (t.theme && t.theme !== theme) { /* ignore */ }
      }
    };
    provider.awareness.on("change", onAwarenessChange);

    return () => {
      provider.awareness.off("change", onAwarenessChange);
      binding.destroy();
      editor.dispose();
      provider.destroy();
      ydoc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // When local language changes, apply + broadcast
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    monaco.editor.setModelLanguage(ed.getModel(), language);
    setAwareness({ language });
  }, [language]);

  // When local theme changes, apply + broadcast (we DO NOT read theme from awareness)
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
      {/* Toolbar (follows editor theme, not app theme) */}
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

      {/* Editor canvas */}
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
