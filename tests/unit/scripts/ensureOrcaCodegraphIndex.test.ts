import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve(process.cwd(), 'scripts/ensure-orca-codegraph-index.mjs');
const temporaryPaths: string[] = [];

function makeTemporaryDirectory(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryPaths.push(directory);
  return directory;
}

afterEach(() => {
  for (const path of temporaryPaths.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

describe('ensure-orca-codegraph-index', () => {
  it('initializes a missing index only in an Orca worktree', () => {
    const workspace = makeTemporaryDirectory('isf-codegraph-worktree-');
    const binDirectory = makeTemporaryDirectory('isf-codegraph-bin-');
    const callLog = join(workspace, 'codegraph-call.log');
    const executablePath = join(binDirectory, 'codegraph');

    writeFileSync(
      executablePath,
      '#!/bin/sh\nprintf "%s" "$*" > "$CODEGRAPH_CALL_LOG"\nmkdir -p .codegraph\n',
    );
    chmodSync(executablePath, 0o755);

    execFileSync(process.execPath, [scriptPath], {
      cwd: workspace,
      env: {
        ...process.env,
        CODEGRAPH_CALL_LOG: callLog,
        ORCA_WORKTREE_ID: 'repo-id::/tmp/worktree',
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      },
    });

    expect(readFileSync(callLog, 'utf8')).toBe('init .');
  });

  it('does not invoke CodeGraph outside an Orca worktree', () => {
    const workspace = makeTemporaryDirectory('isf-codegraph-plain-');
    const binDirectory = makeTemporaryDirectory('isf-codegraph-bin-');
    const callLog = join(workspace, 'codegraph-call.log');
    const executablePath = join(binDirectory, 'codegraph');

    writeFileSync(executablePath, '#!/bin/sh\nprintf "called" > "$CODEGRAPH_CALL_LOG"\n');
    chmodSync(executablePath, 0o755);

    execFileSync(process.execPath, [scriptPath], {
      cwd: workspace,
      env: {
        ...process.env,
        CODEGRAPH_CALL_LOG: callLog,
        ORCA_WORKTREE_ID: '',
        PATH: `${binDirectory}:${process.env.PATH ?? ''}`,
      },
    });

    expect(() => readFileSync(callLog, 'utf8')).toThrow();
  });
});
