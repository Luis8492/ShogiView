// eslint.config.js

module.exports = (async () => {
  const { default: obsidianmd } = await import("eslint-plugin-obsidianmd");

  const flattenExtends = (configs) =>
    configs.flatMap((config) => {
      if (!config || typeof config !== "object") {
        return [config];
      }

      const { extends: extendConfigs, ...rest } = config;
      const flattened = [];

      if (extendConfigs) {
        const normalizedExtends = Array.isArray(extendConfigs)
          ? extendConfigs.flatMap((entry) =>
              Array.isArray(entry) ? entry : [entry]
            )
          : [extendConfigs];

        flattened.push(...flattenExtends(normalizedExtends));
      }

      if (Object.keys(rest).length > 0) {
        flattened.push(rest);
      }

      return flattened;
    });

  return [
    {
      ignores: ["node_modules/", "main.js"],
    },
    ...flattenExtends([...obsidianmd.configs.recommended]),
    {
      files: ["**/*.ts"],
      languageOptions: {
        parserOptions: {
          project: "./tsconfig.json",
        },
      },
      rules: {
	'obsidianmd/ui/sentence-case': ['warn', {
        allowAutoFix: true,
      }],
      },
    },
  ];
})();
