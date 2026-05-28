import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "*.config.mjs", "*.config.ts"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // unused variables — prefix intentionally unused with _
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],

      // avoid any — warn instead of error to allow gradual adoption
      "@typescript-eslint/no-explicit-any": "warn",

      // no console.log left in committed code
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // enforce === over ==
      "eqeqeq": ["error", "always"],

      // no empty functions without a comment
      "@typescript-eslint/no-empty-function": "warn",
    },
  },
];
