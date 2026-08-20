import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];

function displayPath(path) {
  return relative(root, path) || path;
}

function requireFile(path) {
  try {
    const stat = statSync(path);
    if (!stat.isFile()) {
      failures.push(`${displayPath(path)} exists but is not a file`);
      return '';
    }
    return readFileSync(path, 'utf8');
  } catch {
    failures.push(`${displayPath(path)} is missing`);
    return '';
  }
}

function requireIncludes(path, content, markers) {
  for (const marker of markers) {
    if (!content.includes(marker)) {
      failures.push(`${displayPath(path)} is missing required marker: ${marker}`);
    }
  }
}

function requireAbsent(path, content, markers) {
  for (const marker of markers) {
    if (content.includes(marker)) {
      failures.push(`${displayPath(path)} must not contain marker: ${marker}`);
    }
  }
}

function requireMissing(path, reason) {
  try {
    statSync(path);
    failures.push(`${displayPath(path)} must not exist: ${reason}`);
  } catch {
    return;
  }
}

const agentsPath = 'AGENTS.md';
const verifySkillPath = '.agents/skills/verify-repository-change/SKILL.md';
const reviewSkillPath = '.agents/skills/review-product-experience/SKILL.md';
const ciWorkflowPath = '.github/workflows/ci.yml';
const packagePath = 'package.json';

const agents = requireFile(agentsPath);
requireIncludes(agentsPath, agents, [
  '## Code Review Rules',
  'Product PRD',
  'Simulation, Portfolio, or Account Map write Main-owned',
  'partial import behavior',
  'style-only comments',
]);

const verifySkill = requireFile(verifySkillPath);
requireIncludes(verifySkillPath, verifySkill, [
  'name: verify-repository-change',
  'Change Surface Routing',
  'CI, harness, or agent workflow',
  'npm run check:harness',
  'Handoff Format',
]);

const reviewSkill = requireFile(reviewSkillPath);
requireIncludes(reviewSkillPath, reviewSkill, [
  'name: review-product-experience',
  'Product PRD',
  'browser evidence',
]);

requireMissing(
  '.github/codex/prompts/review.md',
  'API-key based Codex Action review is outside the repository harness scope',
);
requireMissing(
  '.github/workflows/codex-review.yml',
  'API-key based Codex Action review is outside the repository harness scope',
);

const ciWorkflow = requireFile(ciWorkflowPath);
requireIncludes(ciWorkflowPath, ciWorkflow, [
  'name: CI',
  'pull_request:',
  'branches: ["main"]',
  'node-version: 22',
  'npm install --legacy-peer-deps',
  'npm run check:ci',
]);
requireAbsent(ciWorkflowPath, ciWorkflow, [
  'openai/codex-action@v1',
  'OPENAI_API_KEY',
  'pull_request_target',
]);

for (const workflowFile of readdirSync('.github/workflows')) {
  if (!workflowFile.endsWith('.yml') && !workflowFile.endsWith('.yaml')) continue;
  const workflowPath = join('.github/workflows', workflowFile);
  const workflow = requireFile(workflowPath);
  requireAbsent(workflowPath, workflow, [
    'openai/codex-action@v1',
    'OPENAI_API_KEY',
    'pull_request_target',
  ]);
}

const packageJson = JSON.parse(requireFile(packagePath));
const scripts = packageJson.scripts ?? {};
const expectedScripts = {
  'check:harness': 'node scripts/check-agent-harness.mjs',
  'check:ci': 'npm run check:harness && npm run check && npm run test:unit',
};
for (const [name, command] of Object.entries(expectedScripts)) {
  if (scripts[name] !== command) {
    failures.push(`package.json scripts.${name} must be ${JSON.stringify(command)}`);
  }
}

if (failures.length > 0) {
  console.error('Agent harness check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Agent harness check passed.');
