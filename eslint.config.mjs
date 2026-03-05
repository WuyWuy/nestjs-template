// @ts-check
import eslint from '@eslint/js'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'

export default [
  eslint.configs.recommended,

  {
    files: ['**/*.ts'],

    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.node,
        ...globals.jest,
        Bun: 'readonly',  //Bun la API duoc support san, eslint khong biet dieu nay nen bao loi 
      },
    },

    plugins: {
      '@typescript-eslint': tsPlugin,
    },

    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
]