import React, { useEffect, useRef, useState } from "react";
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

  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState("vs-dark");

  // broadcast toolbar changes via Yjs awareness (so everyone stays in sync)
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

    const editor = monaco.editor.create(containerRef.current, {
      value: "",
      language,
      theme,
      automaticLayout: true,
      lineNumbers: "on",
      minimap: { enabled: true },
      wordWrap: "off", // wrap permanently off (per request)
      tabSize: 2,
      insertSpaces: true,
      fontSize: 14,
      fontLigatures: true,
      cursorBlinking: "smooth",
      smoothScrolling: true,
      autoClosingBrackets: "languageDefined",
      autoClosingQuotes: "languageDefined",
      formatOnType: false, // no format option anymore
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

    // seed awareness with current toolbar state
    provider.awareness.setLocalStateField("toolbar", { language, theme });

    const onAwarenessChange = () => {
      const states = Array.from(provider.awareness.getStates().values());
      for (let i = states.length - 1; i >= 0; i--) {
        const t = states[i]?.toolbar;
        if (!t) continue;
        if (t.language && t.language !== language) {
          setLanguage(t.language);
          monaco.editor.setModelLanguage(editor.getModel(), t.language);
        }
        if (t.theme && t.theme !== theme) {
          setTheme(t.theme);
          monaco.editor.setTheme(t.theme);
        }
        break;
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

  // keep Monaco + awareness in sync
  useEffect(() => {
    if (!editorRef.current) return;
    monaco.editor.setModelLanguage(editorRef.current.getModel(), language);
    setAwareness({ language });
  }, [language]);

  useEffect(() => {
    if (!editorRef.current) return;
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
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: 8,
          borderBottom: "1px solid #222",
          background: "#0f0f14",
        }}
      >
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={selStyle}
          title="Language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>

        {/* spacer */}
        <div style={{ marginLeft: "auto" }} />

        <button
          onClick={() => setTheme(theme === "vs-dark" ? "vs" : "vs-dark")}
        >
          {theme === "vs-dark" ? "Light theme" : "Dark theme"}
        </button>

        {/* Download on the right */}
        <button onClick={downloadCode} title="Download current buffer">
          Download
        </button>
      </div>

      {/* Editor */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

const selStyle = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #444",
  background: "#1a1a1f",
  color: "#eee",
};

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
