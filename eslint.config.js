import { defineConfig, globalIgnores } from "eslint/config";
import babelParser from "@babel/eslint-parser";
import globals from "globals";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const typescriptLanguageOptions = (jsx) => ({
  ecmaVersion: 2022,
  sourceType: "module",
  parser: babelParser,
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ["@babel/preset-typescript"],
      plugins: jsx ? ["@babel/plugin-syntax-jsx"] : [],
    },
  },
});

const commonRules = {
  "no-undef": "off",
  "no-unused-vars": "off",
  "no-redeclare": "off",
  "no-empty": ["error", { allowEmptyCatch: true }],
  eqeqeq: ["error", "always", { null: "ignore" }],
  "prefer-const": "error",
  "no-var": "error",
};

const viewsRules = {
  ...reactHooksPlugin.configs.recommended.rules,
  ...commonRules,
  "react-hooks/set-state-in-effect": "warn",
};

export default defineConfig([
  {
    files: ["src/views/**/*.ts"],
    plugins: { "react-hooks": reactHooksPlugin },
    languageOptions: {
      ...typescriptLanguageOptions(false),
      globals: globals.browser,
    },
    rules: viewsRules,
  },
  {
    files: ["src/views/**/*.tsx"],
    plugins: { "react-hooks": reactHooksPlugin },
    languageOptions: {
      ...typescriptLanguageOptions(true),
      globals: globals.browser,
    },
    rules: viewsRules,
  },
  {
    files: ["src/server/**/*.ts", "src/shared/**/*.ts", "src/electrobun/**/*.ts"],
    languageOptions: {
      ...typescriptLanguageOptions(false),
      globals: globals.node,
    },
    rules: commonRules,
  },
  globalIgnores(["dist/**", "node_modules/**", "**/*.d.ts"]),
]);
