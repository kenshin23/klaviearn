import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// Vitest runs with `globals: true` (see vitest.config.js), so the test API is
// ambient rather than imported.
const vitestGlobals = Object.fromEntries(
  ["describe", "it", "test", "expect", "vi", "beforeEach", "afterEach", "beforeAll", "afterAll"]
    .map(name => [name, "readonly"]),
);

export default [
  { ignores: ["dist/**", "dev-dist/**", "node_modules/**"] },

  js.configs.recommended,
  // v7 keeps the legacy shape at .configs; the flat-config ones live under .flat
  reactHooks.configs.flat["recommended-latest"],

  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // An unused argument can legitimately document a callback's shape; an
      // unused variable is just dead code. Underscore opts out of both.
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",

      // react-hooks v7 ships the React Compiler rules. They flag patterns this
      // app uses deliberately and documents in comments — the `live` ref that
      // keeps once-wired MIDI listeners off stale state, per-exercise state
      // resets in effects, Date.now() for a session key. Advisory, not
      // blocking: they are the to-do list for adopting the compiler, not a
      // verdict on working code. The classic rules-of-hooks and
      // exhaustive-deps checks stay on at their default severity.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
    },
  },

  {
    files: ["src/**/*.test.{js,jsx}", "src/test/**/*.{js,jsx}"],
    languageOptions: { globals: { ...globals.node, ...vitestGlobals } },
  },

  {
    files: ["vite.config.js", "vitest.config.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
];
