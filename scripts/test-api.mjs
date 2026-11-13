import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';

async function tests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(entry =>
        entry.isDirectory()
          ? tests(`${dir}/${entry.name}`)
          : entry.name.endsWith('.test.ts')
            ? [`${dir}/${entry.name}`]
            : [],
      ),
    )
  ).flat();
}
const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...(await tests('src'))], {
  stdio: 'inherit',
});
child.on('error', error => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', code => (process.exitCode = code ?? 1));
