// eslint.config.js
const obsidianmd = require("eslint-plugin-obsidianmd");

module.exports = [
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
