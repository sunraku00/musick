import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { build } from 'vite';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
let commitHash = 'd3e530d';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch {}
process.env.COMMIT_HASH = commitHash;

async function buildAll() {
  console.log(`--- Membangun Renderer Musick v${pkg.version} (${commitHash}) ---`);
  await build({
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __COMMIT_HASH__: JSON.stringify(commitHash),
    },
    build: {
      outDir: 'dist/renderer',
      emptyOutDir: true,
    },
  });

  console.log('--- Membangun Preload Script ---');
  await build({
    configFile: false,
    build: {
      target: 'node20',
      emptyOutDir: true,
      outDir: 'dist/preload',
      lib: {
        entry: path.resolve('src/preload/index.ts'),
        formats: ['cjs'],
        fileName: () => 'index.cjs',
      },
      rollupOptions: {
        external: ['electron'],
      },
    },
  });

  console.log('--- Membangun Main Process (Electron) ---');
  await build({
    configFile: false,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __COMMIT_HASH__: JSON.stringify(commitHash),
    },
    build: {
      target: 'node20',
      emptyOutDir: true,
      outDir: 'dist/main',
      ssr: true,
      lib: {
        entry: path.resolve('src/main/index.ts'),
        formats: ['es'],
        fileName: () => 'index.js',
      },
      rollupOptions: {
        external: [
          'electron',
          'path',
          'url',
          'fs',
          'http',
          'https',
          'child_process',
          'node:sqlite',
          'node:fs',
          'node:path',
          'node:url',
          'node:child_process',
        ],
      },
    },
  });

  console.log('✓ Seluruh proses build selesai!');
}

buildAll().catch((err) => {
  console.error('Build gagal:', err);
  process.exit(1);
});
