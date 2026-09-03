/// <reference types="node" />

import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const fixtureRoot = resolve(process.cwd(), 'tests/unit/journey/fixtures/routeClosure');

const supportedEntries = [
  'index.html',
  'apps/main/index.html',
  'apps/simulation/index.html',
  'apps/portfolio/index.html',
  'apps/account-map/index.html',
] as const;

const forbiddenFiles = [
  'apps/main/app.js',
  'apps/main/styles.css',
  'shared/legacy/sw.js',
] as const;

const forbiddenDirectories = [
  'apps/main/modules',
  'shared/components',
  'shared/storage',
  'shared/pwa',
  'shared/core',
  'shared/styles',
] as const;

const forbiddenRuntimeTokens = [
  'CompatibilityBridge',
  'IsfStore',
  'isf-rebuild-v1',
  'window.ISF',
] as const;

const retiredPaths = [
  'apps/main/app.js',
  'apps/main/styles.css',
  'apps/main/modules',
  'shared/components',
  'shared/storage',
  'shared/pwa',
  'shared/core',
  'shared/styles',
  'shared/legacy/sw.js',
  'src/core/storage/CompatibilityBridge.ts',
  'src/core/storage/BackupService.ts',
  'src/core/storage/IsfStore.ts',
  'src/core/types/models.ts',
  'src/core/types/money.ts',
  'tests/unit/core/IsfStore.test.ts',
  'tests/step1.spec.ts',
] as const;

describe('supported route closure', () => {
  it('keeps every supported Vite entry free of retired runtime contracts', async () => {
    const projectRoot = process.cwd();
    const assets = await readSupportedRouteClosure(projectRoot);

    expect(assets.has(resolve(projectRoot, 'shared/brand/mainBrandGeometry.js'))).toBe(true);
    expect(findForbiddenRuntimePaths(projectRoot, assets.keys())).toEqual([]);

    const runtime = [...assets.values()].join('\n');
    for (const forbidden of forbiddenRuntimeTokens) {
      expect(runtime).not.toContain(forbidden);
    }
  });

  it('physically retires classified legacy paths while retaining current brand geometry', async () => {
    const projectRoot = process.cwd();

    for (const retiredPath of retiredPaths) {
      await expect(stat(resolve(projectRoot, retiredPath))).rejects.toMatchObject({ code: 'ENOENT' });
    }
    await expect(stat(resolve(projectRoot, 'shared/brand/mainBrandGeometry.js')))
      .resolves.toMatchObject({ isFile: expect.any(Function) });
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

  it('includes stylesheets imported by runtime modules', async () => {
    const graph = await readRuntimeGraph(join(fixtureRoot, 'ast/entry.ts'));

    expect(graph.has(join(fixtureRoot, 'ast/styles.css'))).toBe(true);
  });
});

describe('canonical runtime path isolation', () => {
  const projectRoot = join(fixtureRoot, 'canonical');
  const forbiddenApp = join(projectRoot, 'apps/main/app.js');
  const forbiddenStylesheet = join(projectRoot, 'apps/main/styles.css');

  it('detects forbidden Main paths reached from an HTML route closure', async () => {
    const assets = await readRouteAssets(
      projectRoot,
      join(projectRoot, 'apps/main/index.html'),
    );

    expect(findForbiddenRuntimePaths(projectRoot, assets.keys())).toEqual([
      forbiddenStylesheet,
      forbiddenApp,
    ]);
    expect([...assets.values()].join('\n')).toContain('CompatibilityBridge');
  });
});

async function readSupportedRouteClosure(projectRoot: string): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  for (const supportedEntry of supportedEntries) {
    for (const entry of await readRouteAssets(projectRoot, resolve(projectRoot, supportedEntry))) {
      assets.set(...entry);
    }
  }
  return assets;
}

async function readRouteAssets(projectRoot: string, htmlPath: string): Promise<Map<string, string>> {
  const assets = new Map<string, string>();
  assets.set(resolve(htmlPath), await readFile(htmlPath, 'utf8'));
  for (const assetPath of await readHtmlAssetPaths(projectRoot, htmlPath)) {
    const graph = await readRuntimeGraph(assetPath);
    for (const entry of graph) assets.set(...entry);
  }
  return assets;
}

async function readRuntimeGraph(entryPath: string): Promise<Map<string, string>> {
  const graph = new Map<string, string>();

  async function visit(modulePath: string): Promise<void> {
    const resolvedPath = resolve(modulePath);
    if (graph.has(resolvedPath)) return;

    const source = await readFile(resolvedPath, 'utf8');
    graph.set(resolvedPath, source);

    const specifiers = extname(resolvedPath) === '.css'
      ? readStaticRelativeCssImports(source)
      : readStaticRelativeImports(resolvedPath, source);
    for (const specifier of specifiers) {
      const importedPath = await resolveStaticImport(resolvedPath, specifier);
      if (importedPath !== null) await visit(importedPath);
    }
  }

  await visit(entryPath);
  return graph;
}

async function readHtmlAssetPaths(projectRoot: string, htmlPath: string): Promise<string[]> {
  const html = await readFile(htmlPath, 'utf8');
  const document = new DOMParser().parseFromString(html, 'text/html');
  return [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
    'script[src], link[rel~="stylesheet"][href]',
  )]
    .map((asset) => resolveHtmlAssetPath(
      projectRoot,
      htmlPath,
      asset.tagName === 'SCRIPT' ? asset.getAttribute('src') : asset.getAttribute('href'),
    ))
    .filter((assetPath): assetPath is string => assetPath !== null);
}

function resolveHtmlAssetPath(projectRoot: string, htmlPath: string, source: string | null): string | null {
  if (source === null || /^(?:[a-z][a-z+.-]*:|\/\/)/i.test(source)) return null;
  const [pathWithoutQuery] = source.split(/[?#]/, 1);
  if (pathWithoutQuery === '') return null;
  return pathWithoutQuery.startsWith('/')
    ? resolve(projectRoot, `.${pathWithoutQuery}`)
    : resolve(dirname(htmlPath), pathWithoutQuery);
}

function findForbiddenRuntimePaths(projectRoot: string, runtimePaths: Iterable<string>): string[] {
  const resolvedForbiddenFiles = new Set(forbiddenFiles.map((file) => resolve(projectRoot, file)));
  const resolvedForbiddenDirectories = forbiddenDirectories.map((directory) => resolve(projectRoot, directory));
  const matches = new Set<string>();

  for (const runtimePath of runtimePaths) {
    const normalizedPath = resolve(runtimePath);
    if (resolvedForbiddenFiles.has(normalizedPath)
      || resolvedForbiddenDirectories.some((directory) => normalizedPath.startsWith(`${directory}${sep}`))) {
      matches.add(normalizedPath);
    }
  }
  return [...matches];
}

function readStaticRelativeCssImports(source: string): string[] {
  return [...source.matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?/g)]
    .map((match) => match[1])
    .filter((specifier) => specifier.startsWith('.'));
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
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css'];
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
