// Builds dist/ (ESM, an IIFE with the global `BubbleMaker`, and type declarations)
// and, with --demo, the GitHub Pages demo in docs/.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => path.join(root, ...p);
rmSync(at('dist'), { recursive: true, force: true });

await build({ entryPoints: [at('src/index.ts')], bundle: true, format: 'esm', target: 'es2020', outfile: at('dist/index.js'), sourcemap: true, logLevel: 'warning' });
await build({ entryPoints: [at('src/index.ts')], bundle: true, format: 'iife', globalName: 'BubbleMaker', target: 'es2020', minify: true, outfile: at('dist/bubble-maker.global.js'), logLevel: 'warning' });
execSync('npx tsc -p tsconfig.json', { cwd: root, stdio: 'inherit' });

if (process.argv.includes('--demo')) {
  mkdirSync(at('docs'), { recursive: true });
  copyFileSync(at('demo/index.html'), at('docs/index.html'));
  copyFileSync(at('dist/bubble-maker.global.js'), at('docs/bubble-maker.global.js'));
  console.log('demo -> docs/');
}
console.log('built dist/');
