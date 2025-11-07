// eslint.config.js
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // 推奨セットから外したいルールがあればここで上書き
      // "obsidianmd/sample-names": "off",
    },
  },
];
