import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const children = new Set();
let stopping = false;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function stop(signal = 'SIGTERM') {
  stopping = true;
  for (const child of children) {
    try {
      if (process.platform !== 'win32') {
        process.kill(-child.pid, signal);
      } else {
        child.kill(signal);
      }
    } catch {
      /* The child may already have exited. */
    }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(signal));
}
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
    });
    children.add(child);
    child.once('error', error => {
      children.delete(child);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      children.delete(child);
      if (code === 0 || stopping) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')}: ${signal || code}`));
      }
    });
  });
}
try {
  try {
    await access(new URL('../.env', import.meta.url));
  } catch {
    await copyFile(
      new URL('../.env.example', import.meta.url),
      new URL('../.env', import.meta.url),
      constants.COPYFILE_EXCL,
    );
    console.info('Создан .env для локальной разработки.');
  }
  if (!process.argv.includes('--skip-infra')) {
    await run('docker', ['compose', 'up', '-d', '--wait', 'postgres']);
  }
  if (!stopping) {
    await run(npm, ['run', 'db:generate']);
  }
  if (!stopping) {
    await run(npm, ['run', 'db:push']);
  }
  if (!stopping) {
    await run(npm, ['run', 'build:contracts']);
  }
  if (!stopping) {
    const { BRAND } = await import('@tuckly/contracts');
    console.info(
      `\n${BRAND.name}: http://localhost:5173 — Ctrl+C останавливает API, Mini App и наблюдение контрактов.\n`,
    );
    await Promise.race([
      run(npm, ['run', 'dev', '-w', '@tuckly/contracts']),
      run(npm, ['run', 'dev:api']),
      run(npm, ['run', 'dev:web']),
    ]);
    stop();
  }
} catch (error) {
  if (!stopping) {
    console.error(`Не удалось запустить проект: ${error.message}`);
    process.exitCode = 1;
  }
  stop();
}
