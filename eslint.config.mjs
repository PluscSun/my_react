import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import Prettier from 'eslint-plugin-prettier/recommended';
// const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

export default [
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  // eslintPluginPrettierRecommended
  Prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': ['off']
    }
  }
];
