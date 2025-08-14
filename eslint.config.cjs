/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const { defineConfig, globalIgnores } = require("eslint/config");
const globals = require("globals");
const { fixupConfigRules } = require("@eslint/compat");
const tsParser = require("@typescript-eslint/parser");
const reactRefresh = require("eslint-plugin-react-refresh");
const js = require("@eslint/js");
const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },

      parser: tsParser,
    },

    extends: fixupConfigRules(
      compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:react-hooks/recommended"
      )
    ),

    plugins: {
      "react-refresh": reactRefresh,
    },

    rules: {
      "react-refresh/only-export-components": "off", // Disabled the rule
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      "jsx-a11y/no-access-key": "off",
    },
  },
  globalIgnores(["**/dist", "**/.eslintrc.cjs"]),
]);
