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
  entryPoints: ['server/index-production.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/index.js',
  external: externals,
  sourcemap: false,
  minify: false,
}).catch(() => process.exit(1));