import { build, context } from 'esbuild';
import { rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');

const shared = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: 'out/extension.js',
    external: ['vscode'],
    sourcemap: false,
    target: 'node18',
    logLevel: 'info',
};

rmSync('out/extension.js.map', { force: true });

if (watch) {
    const watcher = await context(shared);
    await watcher.watch();
} else {
    await build(shared);
}
