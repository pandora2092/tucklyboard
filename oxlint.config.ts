import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['import', 'react', 'unicorn', 'typescript'],
  options: {
    typeAware: true,
    typeCheck: false,
  },
  env: {
    browser: true,
    node: true,
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'no-unused-expressions': 'warn',
    'no-debugger': 'error',
    'no-empty': 'error',
    'no-duplicate-imports': 'error',
    'no-import-assign': 'error',
    'no-param-reassign': ['error', { props: false }],
    'no-throw-literal': 'error',
    'no-restricted-imports': ['warn', { paths: ['styled-components'] }],
    'no-undef': 'off',
    'no-plusplus': 'off',
    'no-shadow': 'off',
    'no-var': 'warn',
    'no-empty-function': 'off',
    'sort-imports': 'off',
    'sort-keys': 'off',
    curly: 'error',
    'block-scoped-var': 'warn',
    eqeqeq: 'error',
    'no-eval': 'error',
    'no-unsafe-optional-chaining': 'error',

    'typescript/array-type': ['error', { default: 'array' }],
    'typescript/explicit-function-return-type': 'off',
    'typescript/explicit-module-boundary-types': 'off',
    'typescript/no-explicit-any': 'off',
    'typescript/no-inferrable-types': 'off',
    'typescript/no-require-imports': 'error',
    'typescript/no-unsafe-member-access': 'off',
    'typescript/prefer-regexp-exec': 'off',
    'typescript/no-non-null-asserted-optional-chain': 'error',
    'typescript/no-floating-promises': 'error',

    'react/jsx-key': ['error', { warnOnDuplicates: true }],
    'react/no-array-index-key': 'warn',
    'react/react-in-jsx-scope': 'off',
    'react/rules-of-hooks': 'warn',
    'react/exhaustive-deps': 'warn',
    'react/jsx-props-no-spreading': 'off',
    'react/jsx-curly-brace-presence': [
      'warn',
      { props: 'always', children: 'never', propElementValues: 'always' },
    ],
    'react/jsx-no-target-blank': 'warn',
    'react/no-unknown-property': 'warn',
    'react/display-name': 'off',

    'import/no-default-export': 'warn',
    'import/max-dependencies': ['warn', { max: 15 }],
    'import/newline-after-import': ['warn', { considerComments: true }],
    'import/no-empty-named-blocks': 'warn',
    'import/no-named-as-default': 'off',
    'import/no-named-as-default-member': 'off',
    'import/prefer-default-export': 'off',
    'import/namespace': 'off',

    'unicorn/filename-case': 'off',
  },
  overrides: [
    {
      files: ['*.stories.{ts,tsx}', '*.config.{ts,mts,cts,js,mjs,cjs}', '*.page.tsx'],
      rules: {
        'import/no-default-export': 'off',
      },
    },
  ],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.tsbuildinfo'],
});
