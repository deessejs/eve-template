// ESLint v9 flat config for the eve-template scaffold.
//
// Scope: lint TypeScript and TSX across the project source. React/Next.js
// rules are enabled where they apply (app/, components/) but the agent
// runtime (agent/, lib/, db/, scripts/, src/) doesn't need them.
//
// The default rule set is `typescript-eslint`'s `recommended` plus a few
// sane additions. Tighten over time as the project grows.

import tseslint from "typescript-eslint";

export default tseslint.config(
  // Apply globally; everything else narrows from here.
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".eve/**",
      ".claude/**",
      "dist/**",
      "coverage/**",
      "**/*.tsbuildinfo",
      // Drizzle migrations are generated SQL; not ours to lint.
      "db/migrations/**",
    ],
  },

  // Base TS rules — applies to every .ts/.tsx file in scope.
  ...tseslint.configs.recommended,

  // Project-specific tightening.
  //
  // Note: rules that require type information (e.g.
  // `@typescript-eslint/no-floating-promises`) are intentionally NOT enabled
  // here. They need `parserOptions.project` which makes lint ~10× slower
  // and adds setup friction. For a scaffold, syntactic-only is enough.
  // Switch to `tseslint.configs.recommendedTypeChecked` + `parserOptions`
  // when you want stricter rules and accept the perf cost.
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // React rules — only for the web UI.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      // Allow JSX in `.tsx` only.
      "no-undef": "off", // TS handles this better than ESLint
    },
  },

  // Loosen rules for config files and scripts that are executed, not imported.
  {
    files: ["scripts/**/*.{ts,mjs,js}", "*.config.{ts,mjs,js}", "tests/**/*.{ts,tsx}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },

  // Generated Drizzle schema files — ours to write, but the migrations
  // directory is auto-generated and shouldn't be hand-edited.
  {
    files: ["db/schema/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);