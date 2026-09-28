// Synthetic Git laboratory, not a call to Lody's worktree manager or GC.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'lody-learning-'));
const repo = join(scratch, 'repo');
const work = join(scratch, 'work');
const hooks = join(scratch, 'empty-hooks');
mkdirSync(repo);
mkdirSync(hooks);
const env = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: join(scratch, 'no-global-config'),
};
for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[key];
function git(cwd, ...args) {
  return execFileSync(
    'git',
    [
      '-C',
      cwd,
      '-c',
      'user.name=Learning Fixture',
      '-c',
      'user.email=learning@example.test',
      '-c',
      'commit.gpgsign=false',
      '-c',
      `core.hooksPath=${hooks}`,
      ...args,
    ],
    { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
}
try {
  git(repo, 'init', '-b', 'main');
  writeFileSync(join(repo, '.gitignore'), 'cache.txt\n');
  writeFileSync(join(repo, 'tracked.txt'), 'base');
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'test: synthetic base');
  git(repo, 'worktree', 'add', '-b', 'learning-session', work);
  writeFileSync(join(work, 'tracked.txt'), 'edited');
  writeFileSync(join(work, 'new.txt'), 'untracked work');
  writeFileSync(join(work, 'cache.txt'), 'ignored');
  assert.equal(readFileSync(join(repo, 'tracked.txt'), 'utf8'), 'base');
  git(work, 'add', '-A');
  git(work, 'commit', '-m', 'test: synthetic archive backup');
  git(repo, 'worktree', 'remove', '--force', work);
  assert.equal(existsSync(work), false);
  git(repo, 'show-ref', '--verify', 'refs/heads/learning-session');
  git(repo, 'worktree', 'add', work, 'learning-session');
  assert.equal(readFileSync(join(work, 'tracked.txt'), 'utf8'), 'edited');
  assert.equal(readFileSync(join(work, 'new.txt'), 'utf8'), 'untracked work');
  assert.equal(existsSync(join(work, 'cache.txt')), false);
  assert.equal(git(repo, 'status', '--porcelain'), '');
  git(repo, 'worktree', 'remove', work);
  console.log('worktree: isolation, backup, restore verified');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
