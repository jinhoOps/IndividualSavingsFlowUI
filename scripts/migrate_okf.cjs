const fs = require('fs');
const path = require('path');

const WIKI_DIR = path.join(__dirname, '../.gemini/knowledge/wiki');
const NEW_WIKI_DIR = path.join(__dirname, '../.gemini/knowledge/wiki_new');

// 1. 기존 파일 -> 새 경로 매핑 (상대 경로는 WIKI_DIR 기준)
const fileMap = {
  // wiki root
  'Architecture_Reference': 'core/architecture_reference.md',
  'Data_Model_Reference': 'core/data_model_reference.md',
  'Financial_Taxation_Reference': 'core/financial_taxation_reference.md',
  'INDEX': 'index.md',
  'Knowledge_Harness': 'core/knowledge_harness.md',
  'Operating_Principles': 'core/operating_principles.md',
  'Plan_Step3': 'phases/plan_step3.md',
  'Plan_Step3_Implementation': 'phases/plan_step3_implementation.md',
  'Project_History': 'phases/project_history.md',
  'UI_Standards_Reference': 'core/ui_standards_reference.md',
  'Version_Management_Principles': 'core/version_management_principles.md',
  'log': 'log.md',

  // archive (with or without 'archive/' prefix)
  'archive/Data_Bridge_Import_Pattern': 'archive/data_bridge_import_pattern.md',
  'archive/Feature_Archive_v0.5': 'archive/feature_archive_v0.5.md',
  'archive/Plan_Step1': 'archive/plan_step1.md',
  'archive/Plan_Step2': 'archive/plan_step2.md',
  'archive/Step1_Modularization_Refactoring': 'archive/step1_modularization_refactoring.md',
  'archive/Step2_Modularization_Refactoring': 'archive/step2_modularization_refactoring.md',
  'archive/Storage_Hub_Integration_v0.7': 'archive/storage_hub_integration_v0.7.md',
  'archive/UI_UX_Overhaul_v0.3': 'archive/ui_ux_overhaul_v0.3.md',
  'archive/UI_UX_Overhaul_v0.4': 'archive/ui_ux_overhaul_v0.4.md',
  'archive/log_archive_20260613': 'archive/log_archive_20260613.md',

  // fallback without archive prefix
  'Data_Bridge_Import_Pattern': 'archive/data_bridge_import_pattern.md',
  'Feature_Archive_v0.5': 'archive/feature_archive_v0.5.md',
  'Plan_Step1': 'archive/plan_step1.md',
  'Plan_Step2': 'archive/plan_step2.md',
  'Step1_Modularization_Refactoring': 'archive/step1_modularization_refactoring.md',
  'Step2_Modularization_Refactoring': 'archive/step2_modularization_refactoring.md',
  'Storage_Hub_Integration_v0.7': 'archive/storage_hub_integration_v0.7.md',
  'UI_UX_Overhaul_v0.3': 'archive/ui_ux_overhaul_v0.3.md',
  'UI_UX_Overhaul_v0.4': 'archive/ui_ux_overhaul_v0.4.md',
  'log_archive_20260613': 'archive/log_archive_20260613.md',
};

// 헬퍼: 파일명 이쁘게 만들기
function getTitle(key) {
  const base = key.replace(/^archive\//, '');
  return base.split('_').join(' ');
}

// 헬퍼: 두 상대 경로 간의 상대 마크다운 링크 연산
function getRelativeLink(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  let relPath = path.relative(fromDir, toFile).replace(/\\/g, '/');
  // path.relative는 같은 폴더일 경우 'file.md' 형식으로 반환하므로 상대 경로로 통일하기 위해 앞에 ./ 붙여줌
  if (!relPath.startsWith('.') && !relPath.startsWith('/')) {
    relPath = './' + relPath;
  }
  return relPath;
}

// 헬퍼: YAML Frontmatter 수정 및 보완
function processFrontmatter(content, key) {
  const yamlRegex = /^---([\s\S]*?)---/;
  const match = content.match(yamlRegex);
  
  let frontmatterData = {};
  let bodyContent = content;

  if (match) {
    bodyContent = content.slice(match[0].length);
    const yamlStr = match[1];
    yamlStr.split('\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const k = parts[0].trim();
        const v = parts.slice(1).join(':').trim();
        frontmatterData[k] = v;
      }
    });
  }

  // OKF index.md 전용 프론트매터 분기
  if (key === 'INDEX') {
    return `---
okf_version: "0.1"
---
` + bodyContent;
  }

  // OKF 필수/권장 필드 맵핑
  const type = frontmatterData.type || 'node';
  const title = frontmatterData.title || `"${getTitle(key)}"`;
  const description = frontmatterData.description || `"${getTitle(key)} reference documentation."`;
  const tags = frontmatterData.tags || '[]';
  
  // timestamp 처리 (created에서 마이그레이션)
  let timestamp = frontmatterData.timestamp;
  if (!timestamp) {
    const created = frontmatterData.created || new Date().toISOString().split('T')[0];
    // YYYY-MM-DD -> YYYY-MM-DDT00:00:00Z
    if (/^\d{4}-\d{2}-\d{2}$/.test(created)) {
      timestamp = `${created}T00:00:00Z`;
    } else {
      timestamp = new Date().toISOString();
    }
  }

  // YAML 블록 재생성
  const newYaml = `---
type: ${type}
title: ${title}
description: ${description}
tags: ${tags}
timestamp: ${timestamp}
---
`;

  return newYaml + bodyContent;
}

// 헬퍼: [[WikiLink]] -> [Label](relative_path)로 치환
function convertWikiLinks(content, currentNewPath) {
  // [[LinkName]] 또는 [[LinkName|Label]] 또는 [[LinkName#Section]] 패턴
  const wikiLinkRegex = /\[\[(.*?)\]\]/g;
  
  return content.replace(wikiLinkRegex, (match, p1) => {
    let linkPart = p1;
    let labelPart = p1;
    
    if (p1.includes('|')) {
      const parts = p1.split('|');
      linkPart = parts[0];
      labelPart = parts[1];
    }
    
    // 섹션 앵커(#) 분리
    let anchor = '';
    if (linkPart.includes('#')) {
      const parts = linkPart.split('#');
      linkPart = parts[0];
      anchor = '#' + parts[1];
    }
    
    // fileMap에 매핑된 대상 경로 조회
    const targetNewPath = fileMap[linkPart];
    
    if (targetNewPath) {
      const relLink = getRelativeLink(currentNewPath, targetNewPath) + anchor;
      return `[${labelPart}](${relLink})`;
    } else {
      console.warn(`Warning: No mapping found for link [[${p1}]] in ${currentNewPath}`);
      return `[${labelPart}](#broken-link-${linkPart})`;
    }
  });
}

function migrate() {
  if (!fs.existsSync(NEW_WIKI_DIR)) {
    fs.mkdirSync(NEW_WIKI_DIR, { recursive: true });
  }

  // 1. WIKI_DIR 하위 모든 마크다운 파일 조회
  function getFiles(dir, prefix = '') {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (file !== 'archive' || prefix === '') { // archive 폴더도 탐색
          results = results.concat(getFiles(fullPath, prefix + file + '/'));
        }
      } else if (file.endsWith('.md')) {
        results.push(prefix + file.replace('.md', ''));
      }
    });
    return results;
  }

  const allFiles = getFiles(WIKI_DIR);
  console.log(`Found ${allFiles.length} files to migrate.`);

  // 2. 각 파일에 대해 새 경로에 변환 적용하여 기록
  allFiles.forEach(fileKey => {
    // 예: Architecture_Reference 또는 archive/Plan_Step1
    const targetNewPath = fileMap[fileKey];
    if (!targetNewPath) {
      console.error(`Error: File ${fileKey} has no mapping defined.`);
      return;
    }

    const srcPath = path.join(WIKI_DIR, fileKey + '.md');
    const destPath = path.join(NEW_WIKI_DIR, targetNewPath);

    // 목적지 폴더 생성
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    let content = fs.readFileSync(srcPath, 'utf8');

    // YAML 및 링크 치환
    content = processFrontmatter(content, fileKey);
    content = convertWikiLinks(content, targetNewPath);

    fs.writeFileSync(destPath, content, 'utf8');
    console.log(`Migrated: ${fileKey} -> ${targetNewPath}`);
  });

  console.log('Migration completed successfully in temp dir.');
}

migrate();
