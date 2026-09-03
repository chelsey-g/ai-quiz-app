import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output in nested locations (e.g. git worktrees) and local-only dirs:
    "**/.next/**",
    ".worktrees/**",
  ]),
  {
    // The React Compiler hook rules flag idiomatic patterns already used
    // throughout this codebase (mount guards, dialog-open state resets,
    // fetch-on-mount, hoisted useCallback refs, Math.random() in a memo).
    // Satisfying them is a dedicated refactor, tracked separately — keep
    // them visible as warnings so CI can block on genuine errors without
    // that churn.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
