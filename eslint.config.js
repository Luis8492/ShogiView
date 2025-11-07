// eslint.config.js
const obsidianmd = require("eslint-plugin-obsidianmd");

module.exports = [
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
