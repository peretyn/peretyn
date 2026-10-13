import { defineConfig, globalIgnores } from 'eslint/config';
import { strict } from '@peretyn/eslint-config';

export default defineConfig([...strict, globalIgnores(['dist/**', 'src/generated/**'])]);
