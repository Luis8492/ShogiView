// eslint.config.js
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  {
    ignores: ["node_modules/", "main.js"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
    },
  },
];
