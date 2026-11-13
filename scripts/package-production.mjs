import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BRAND } from '@tuckly/contracts';

const root = fileURLToPath(new URL('../', import.meta.url));
const archive = `${BRAND.name}-deploy.tar.gz`;
const temporary = await mkdtemp(join(tmpdir(), `${BRAND.name}-package-`));
try {
  const result = spawnSync(
    'tar',
    [
      '--exclude=node_modules',
      '--exclude=dist',
      '--exclude=.git',
      '--exclude=.agents',
      '--exclude=.codex',
      '--exclude=.aws',
      '--exclude=.ssh',
      '--exclude=.env',
      '--exclude=.env.production',
      '--exclude=.env.local',
      '--exclude=.env.*.local',
      '--exclude=backups',
      '--exclude=*.tar.gz',
      '--exclude=*.sql.gz',
      '-czf',
      join(temporary, archive),
      '.',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Archive creation failed: ${result.status}`);
  }
  await copyFile(join(temporary, archive), join(root, archive));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.info(`Created ${root}${archive}. Transfer .env.production separately over SSH.`);
