import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
await mkdir('dist/cjs', { recursive: true });
await writeFile('dist/cjs/package.json', JSON.stringify({ type: 'commonjs' }));
const watch = process.argv.includes('--watch');
const children = [];
let stopping = false;
const run = config =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        require.resolve('typescript/bin/tsc'),
        '-p',
        config,
        ...(watch ? ['--watch', '--preserveWatchOutput'] : []),
      ],
      { stdio: 'inherit' },
    );
    children.push(child);
    child.on('error', reject);
    child.on('exit', code =>
      code === 0 || stopping ? resolve() : reject(new Error(`Contracts compiler exited: ${code}`)),
    );
  });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    for (const child of children) {
      child.kill(signal);
    }
  });
}
try {
  if (watch) {
    await Promise.all([run('tsconfig.json'), run('tsconfig.cjs.json')]);
  } else {
    await run('tsconfig.json');
    await run('tsconfig.cjs.json');
  }
} catch (error) {
  if (!stopping) {
    console.error(error.message);
  }
  for (const child of children) {
    child.kill();
  }
  if (!stopping) {
    process.exitCode = 1;
  }
}
