import { plugin as shadcn } from '@shadcn/lint';
import { defineConfig, globalIgnores } from 'eslint/config';
import { readability, typescript } from '@peretyn/eslint-config';
import reactHooks from 'eslint-plugin-react-hooks';

const VENDORED_SHADCN_CODE = ['src/components/**', 'src/hooks/**'];

export default defineConfig([
  ...typescript,
  ...readability.map((config) => ({ ...config, ignores: VENDORED_SHADCN_CODE })),
  reactHooks.configs.flat['recommended-latest'],
  globalIgnores(['dist/**']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { shadcn },
  },
  {
    files: VENDORED_SHADCN_CODE,
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
