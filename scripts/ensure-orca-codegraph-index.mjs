import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (!process.env.ORCA_WORKTREE_ID || existsSync(join(process.cwd(), '.codegraph'))) {
  process.exit(0);
}

try {
  execFileSync('codegraph', ['init', '.'], { stdio: 'inherit' });
} catch {
  console.warn('CodeGraph index initialization was skipped because the codegraph CLI is unavailable.');
}
