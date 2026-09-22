import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  // ── Base JS recommended ───────────────────────────────────────────────────
  js.configs.recommended,

  // ── TypeScript files ──────────────────────────────────────────────────────
  {
    files: ["server/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module",
        ecmaVersion: "latest",
      },
      globals: {
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setImmediate: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // ── Prettier formatting (treated as ESLint errors) ───────────────────
      "prettier/prettier": "warn",

      // ── TypeScript migration rules ───────────────────────────────────────
      // Existing backend code predates flat ESLint. Keep these visible without
      // blocking CI until the older modules are cleaned incrementally.
      "no-unused-vars": "off",
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Mongoose model modules intentionally provide runtime and type exports
      // together; forcing split imports creates duplicate declarations.
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-misused-promises": [
        "warn",
        {
          "checksVoidReturn": false
        }
      ],
      "@typescript-eslint/await-thenable": "warn",
      // Authenticated routers establish req.user and tenant invariants before
      // controllers run. Assertions at that boundary reflect the middleware
      // contract and are covered by authentication tests.
      "@typescript-eslint/no-non-null-assertion": "off",

      // ── General code quality ─────────────────────────────────────────────
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-debugger": "error",
      "no-duplicate-imports": "off",
      "no-var": "error",
      "prefer-const": "warn",
      "prefer-template": "warn",
      "object-shorthand": "warn",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "no-throw-literal": "error",

      // ── Security rules ───────────────────────────────────────────────────
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
    },
  },

  // Seed and migration commands are operator-facing CLIs, so stdout is their
  // intended interface rather than the long-running HTTP service logger.
  {
    files: ["server/scripts/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // ── Disable rules that conflict with Prettier ────────────────────────────
  prettierConfig,

  // ── Ignore patterns ───────────────────────────────────────────────────────
  {
    ignores: ["node_modules/**", "build/**", "dist/**", "**/*.js", "**/*.d.ts"],
  },
];
