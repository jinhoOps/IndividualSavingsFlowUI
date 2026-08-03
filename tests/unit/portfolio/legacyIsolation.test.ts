/// <reference types="node" />

import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const fixtureRoot = resolve(process.cwd(), 'tests/unit/portfolio/fixtures/legacyIsolation');

describe('Portfolio legacy isolation', () => {
  it('keeps current runtime free of legacy Portfolio contracts', async () => {
    const projectRoot = process.cwd();
    const portfolioEntry = resolve(process.cwd(), 'src/portfolio/main.tsx');
    const mainSource = resolve(process.cwd(), 'src/portfolio/infrastructure/mainSourceRepository.ts');
    const mainValidation = resolve(process.cwd(), 'src/main/domain/validation.ts');
    const htmlPath = resolve(process.cwd(), 'apps/portfolio/index.html');
    const graph = await readRuntimeGraph(portfolioEntry);

    expect(graph.has(mainSource)).toBe(true);
    expect(graph.has(mainValidation)).toBe(true);

    const htmlRuntimePaths = await readHtmlScriptPaths(projectRoot, htmlPath);
    expect(findForbiddenRuntimePaths(projectRoot, [...graph.keys(), ...htmlRuntimePaths])).toEqual([]);

    const entry = await readFile(htmlPath, 'utf8');
    const runtime = `${[...graph.values()].join('\n')}\n${entry}`;
    for (const forbidden of [
      'apps/portfolio/app.js',
      'apps/portfolio/modules',
      'src/entries/step3.ts',
      'isf-step3-portfolios-v2',
      'isf-step3-snapshots-v1',
      'IsfStorageHub',
      'isf-rebuild-v1',
    ]) {
      expect(runtime).not.toContain(forbidden);
    }
  });
});

describe('readRuntimeGraph', () => {
  it('follows comment-separated side-effect imports', async () => {
    const graph = await readRuntimeGraph(join(fixtureRoot, 'ast/entry.ts'));

    expect(graph.has(join(fixtureRoot, 'ast/runtime.js'))).toBe(true);
  });

  it('excludes type-only imports from the runtime graph', async () => {
    const graph = await readRuntimeGraph(join(fixtureRoot, 'ast/entry.ts'));

    expect(graph.has(join(fixtureRoot, 'ast/type-only.ts'))).toBe(false);
  });
});

describe('canonical runtime path isolation', () => {
  const projectRoot = join(fixtureRoot, 'canonical');
  const forbiddenApp = join(projectRoot, 'apps/portfolio/app.js');

  it('detects a forbidden canonical path reached through relative imports', async () => {
    const graph = await readRuntimeGraph(join(projectRoot, 'apps/portfolio/entry.js'));

    expect(findForbiddenRuntimePaths(projectRoot, graph.keys())).toEqual([forbiddenApp]);
  });

  it('detects a forbidden canonical path resolved from an HTML module script', async () => {
    const htmlPaths = await readHtmlScriptPaths(
      projectRoot,
      join(projectRoot, 'apps/portfolio/index.html'),
    );

    expect(findForbiddenRuntimePaths(projectRoot, htmlPaths)).toEqual([forbiddenApp]);
  });

  it('detects a forbidden canonical path resolved from a classic HTML script', async () => {
    const htmlPaths = await readHtmlScriptPaths(
      projectRoot,
      join(projectRoot, 'apps/portfolio/classic.html'),
    );

    expect(findForbiddenRuntimePaths(projectRoot, htmlPaths)).toEqual([forbiddenApp]);
  });
});

async function readRuntimeGraph(entryPath: string): Promise<Map<string, string>> {
  const graph = new Map<string, string>();

  async function visit(modulePath: string): Promise<void> {
    const resolvedPath = resolve(modulePath);
    if (graph.has(resolvedPath)) return;

    const source = await readFile(resolvedPath, 'utf8');
    graph.set(resolvedPath, source);

    for (const specifier of readStaticRelativeImports(resolvedPath, source)) {
      const importedPath = await resolveStaticImport(resolvedPath, specifier);
      if (importedPath !== null) await visit(importedPath);
    }
  }

  await visit(entryPath);
  return graph;
}

async function readHtmlScriptPaths(projectRoot: string, htmlPath: string): Promise<string[]> {
  const html = await readFile(htmlPath, 'utf8');
  const document = new DOMParser().parseFromString(html, 'text/html');
  return [...document.querySelectorAll<HTMLScriptElement>('script[src]')]
    .map((script) => resolveHtmlScriptPath(projectRoot, htmlPath, script.getAttribute('src')))
    .filter((scriptPath): scriptPath is string => scriptPath !== null);
}

function resolveHtmlScriptPath(projectRoot: string, htmlPath: string, source: string | null): string | null {
  if (source === null || /^(?:[a-z][a-z+.-]*:|\/\/)/i.test(source)) return null;
  const [pathWithoutQuery] = source.split(/[?#]/, 1);
  if (pathWithoutQuery === '') return null;
  return pathWithoutQuery.startsWith('/')
    ? resolve(projectRoot, `.${pathWithoutQuery}`)
    : resolve(dirname(htmlPath), pathWithoutQuery);
}

function findForbiddenRuntimePaths(projectRoot: string, runtimePaths: Iterable<string>): string[] {
  const forbiddenFiles = new Set([
    resolve(projectRoot, 'apps/portfolio/app.js'),
    resolve(projectRoot, 'src/entries/step3.ts'),
  ]);
  const forbiddenDirectories = [resolve(projectRoot, 'apps/portfolio/modules')];
  const matches = new Set<string>();

  for (const runtimePath of runtimePaths) {
    const normalizedPath = resolve(runtimePath);
    if (forbiddenFiles.has(normalizedPath)
      || forbiddenDirectories.some((directory) => normalizedPath.startsWith(`${directory}${sep}`))) {
      matches.add(normalizedPath);
    }
  }
  return [...matches];
}

function readStaticRelativeImports(modulePath: string, source: string): string[] {
  const specifiers: string[] = [];
  const sourceFile = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true);

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!isTypeOnlyImport(statement)) addRelativeSpecifier(statement.moduleSpecifier);
    } else if (ts.isExportDeclaration(statement)) {
      if (!isTypeOnlyExport(statement) && statement.moduleSpecifier !== undefined) {
        addRelativeSpecifier(statement.moduleSpecifier);
      }
    }
  }
  return specifiers;

  function addRelativeSpecifier(moduleSpecifier: ts.Expression): void {
    if (ts.isStringLiteral(moduleSpecifier) && moduleSpecifier.text.startsWith('.')) {
      specifiers.push(moduleSpecifier.text);
    }
  }
}

function isTypeOnlyImport(declaration: ts.ImportDeclaration): boolean {
  const clause = declaration.importClause;
  if (clause === undefined) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name !== undefined || clause.namedBindings === undefined) return false;
  return ts.isNamedImports(clause.namedBindings)
    && clause.namedBindings.elements.length > 0
    && clause.namedBindings.elements.every((specifier) => specifier.isTypeOnly);
}

function isTypeOnlyExport(declaration: ts.ExportDeclaration): boolean {
  if (declaration.isTypeOnly) return true;
  return declaration.exportClause !== undefined
    && ts.isNamedExports(declaration.exportClause)
    && declaration.exportClause.elements.length > 0
    && declaration.exportClause.elements.every((specifier) => specifier.isTypeOnly);
}

async function resolveStaticImport(importerPath: string, specifier: string): Promise<string | null> {
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  const basePath = resolve(dirname(importerPath), specifier);
  const extension = extname(basePath);
  if (extension !== '' && !supportedExtensions.includes(extension)) return null;

  const candidates = extension === ''
    ? [
      ...supportedExtensions.map((candidateExtension) => `${basePath}${candidateExtension}`),
      ...supportedExtensions.map((candidateExtension) => join(basePath, `index${candidateExtension}`)),
    ]
    : [basePath];

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }
  return null;
}
