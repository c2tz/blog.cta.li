import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import astro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import tseslint from "typescript-eslint";

const SOURCE_FILES = ["public/pagefind-loader.js", "src/**/*.{astro,js,mjs,ts}"];
const NODE_FILES = [
  "*.config.{js,mjs,ts}",
  "astro.config.mjs",
  "lighthouserc.cjs",
  "scripts/**/*.{js,mjs,ts}",
  "src/lib/git-dates.mjs",
  "tests/**/*.{js,mjs,ts}",
];
const ASTRO_A11Y_CONFIGS = astro.configs["flat/jsx-a11y-recommended"].map((config) =>
  config.plugins?.["jsx-a11y"]
    ? { ...config, plugins: { ...config.plugins, "jsx-a11y": jsxA11y } }
    : config,
);

export default defineConfig(
  {
    ignores: [".astro/**", "dist/**", "node_modules/**", "public/pagefind/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs["flat/recommended"],
  ...ASTRO_A11Y_CONFIGS,
  {
    files: SOURCE_FILES,
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "no-console": ["error", { allow: ["error", "info", "warn"] }],
    },
  },
  {
    files: NODE_FILES,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.{astro,js,mjs,ts}"],
    rules: {
      curly: ["error", "multi-line", "consistent"],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "logical-assignment-operators": ["error", "always"],
      "no-duplicate-imports": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-promise-executor-return": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "error",
      "no-unmodified-loop-condition": "error",
      "no-useless-assignment": "error",
      "no-useless-rename": "error",
      "object-shorthand": ["error", "always"],
      "prefer-arrow-callback": ["error", { allowNamedFunctions: true }],
      "prefer-const": "error",
      "prefer-object-has-own": "error",
      "prefer-template": "error",
    },
  },
  {
    files: ["src/components/**/*.astro"],
    rules: {
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["src/assets/js/app/**/*.{js,ts}", "src/lib/**/*.{js,mjs,ts}"],
    rules: {
      "max-lines": ["error", { max: 700, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["tests/**/*.{mjs,ts}"],
    rules: {
      "max-lines": ["error", { max: 900, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["**/*.{ts,mts}", "**/*.astro/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // These focusable overflow regions and modal initial-focus targets are deliberate
    // keyboard accessibility behavior rather than generic tabindex/autofocus usage.
    files: [
      "src/components/home/home-latest-posts-table.astro",
      "src/components/tags/tag-posts.astro",
    ],
    rules: {
      "astro/jsx-a11y/no-noninteractive-tabindex": "off",
    },
  },
  {
    files: ["src/components/image-preview/image-preview.astro"],
    rules: {
      "astro/jsx-a11y/no-autofocus": "off",
    },
  },
);
