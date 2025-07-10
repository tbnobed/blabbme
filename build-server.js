import { build } from 'esbuild';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

// Get all production dependencies to externalize
const externals = [
  ...Object.keys(pkg.dependencies || {}),
  'pg-native',  // Always external
  'vite',       // Development only
  'tsx',        // Development only
  // Babel packages that cause bundling issues
  '@babel/preset-typescript',
  '@babel/core',
  '@babel/preset-env',
  '@babel/preset-react',
  '@babel/plugin-transform-runtime',
  // Additional development dependencies
  'typescript',
  'tailwindcss',
  'autoprefixer',
  'postcss',
  'esbuild',
  'rollup'
];

build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  external: externals,
  sourcemap: false,
  minify: false,
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
    `.trim()
  }
}).catch(() => process.exit(1));