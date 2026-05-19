// src/components/kata-editor.tsx
"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";

const theme = EditorView.theme({
  "&": {
    fontSize: "13px",
    fontFamily: "var(--font-mono, ui-monospace, monospace)",
    background: "transparent",
    height: "100%",
  },
  ".cm-content": { padding: "12px 0" },
  ".cm-gutters": {
    background: "transparent",
    borderRight: "1px solid oklch(1 0 0 / 0.06)",
    color: "oklch(0.5 0 0)",
  },
  ".cm-activeLineGutter": { background: "oklch(1 0 0 / 0.04)" },
  ".cm-activeLine": { background: "oklch(1 0 0 / 0.03)" },
  ".cm-cursor": { borderLeftColor: "#a78bfa" },
  ".cm-selectionBackground": { background: "oklch(0.62 0.19 295 / 0.25) !important" },
});

export default function KataEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={[javascript(), theme]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        dropCursor: false,
        allowMultipleSelections: false,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        highlightActiveLine: true,
        highlightSelectionMatches: false,
        tabSize: 2,
      }}
      theme="dark"
    />
  );
}
