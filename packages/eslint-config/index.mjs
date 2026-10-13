import tseslint from 'typescript-eslint';

const MAX_FUNCTION_LINES = 20;
const MAX_COMPONENT_LINES = 40;
const MAX_DEPTH = 2;
const MAX_PARAMS = 3;
const MAX_COMPLEXITY = 10;
const ALLOWED_NUMBERS = [-1, 0, 1, 2];

const functionLength = (max) => ['error', { max, skipBlankLines: true, skipComments: true }];

export const typescript = tseslint.configs.recommended;

export const readability = [
  {
    rules: {
      'max-depth': ['error', MAX_DEPTH],
      'max-params': ['error', MAX_PARAMS],
      complexity: ['error', MAX_COMPLEXITY],
      'max-lines-per-function': functionLength(MAX_FUNCTION_LINES),
      'no-else-return': ['error', { allowElseIf: false }],
      'no-nested-ternary': 'error',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        {
          ignore: ALLOWED_NUMBERS,
          ignoreArrayIndexes: true,
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          ignoreDefaultValues: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: { 'max-lines-per-function': functionLength(MAX_COMPONENT_LINES) },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.test-d.ts', '**/*.e2e.ts'],
    rules: { 'max-lines-per-function': 'off', '@typescript-eslint/no-magic-numbers': 'off' },
  },
];

export const strict = [...typescript, ...readability];
