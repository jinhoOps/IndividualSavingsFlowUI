const fs = require('fs');
const path = require('path');

const projectPath = 'D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.planning/PROJECT.md';
let projectContent = fs.readFileSync(projectPath, 'utf8');

projectContent = projectContent.replace(
  /## Current Milestone:.*?(?=---)/s,
  '## Current Milestone: v1.7 다중 계좌 매핑 및 에디토리얼 UI 개편\n\n**Goal:** 기존 금액 중심 UI에서 벗어나, 에디토리얼 디자인(Anthropic 스타일의 타이포그래피, 레이아웃 등)을 도입하되 ISF 고유의 기존 컬러 팔레트를 유지하여 전면적인 UI 개편 및 다중 계좌 매핑을 통합한다.\n\n**Target features:**\n- 다중 계좌 매핑 기능 구현\n- DESIGN.md 개편 (ISF 고유 컬러 유지 + Anthropic 스타일의 에디토리얼 타이포그래피 및 레이아웃 구조 적용)\n- 신규 디자인 시스템 기반의 전체 UI 리팩터링 및 입력 편의성 향상\n\n'
);

projectContent = projectContent.replace(
  /### Active \(Next Milestone: v1\.5\)/g,
  '### Active (Next Milestone: v1.7)'
);

const today = new Date().toISOString().split('T')[0];
projectContent = projectContent.replace(
  /\*Last updated:.*?\*/g,
  '*Last updated: ' + today + ' after v1.7 Milestone Initialized*'
);

fs.writeFileSync(projectPath, projectContent, 'utf8');

const statePath = 'D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.planning/STATE.md';
let stateContent = fs.readFileSync(statePath, 'utf8');

stateContent = stateContent.replace(/milestone: .*/, 'milestone: v1.7');
stateContent = stateContent.replace(/milestone_name: .*/, 'milestone_name: "다중 계좌 매핑 및 에디토리얼 UI 개편"');
stateContent = stateContent.replace(/status: .*/, 'status: planning');
stateContent = stateContent.replace(/stopped_at: .*/, 'stopped_at: ');
stateContent = stateContent.replace(/last_activity: .*/, 'last_activity: ' + today + ' -- Milestone v1.7 started');
stateContent = stateContent.replace(/total_phases: .*/, 'total_phases: 0');
stateContent = stateContent.replace(/completed_phases: .*/, 'completed_phases: 0');
stateContent = stateContent.replace(/total_plans: .*/, 'total_plans: 0');
stateContent = stateContent.replace(/completed_plans: .*/, 'completed_plans: 0');
stateContent = stateContent.replace(/percent: .*/, 'percent: 0');

stateContent = stateContent.replace(
  /## Current Position.*?(?=## Project Reference)/s,
  '## Current Position\n\nPhase: Not started (defining requirements)\nPlan: —\nStatus: Defining requirements\nLast activity: ' + today + ' — Milestone v1.7 started\n\n'
);

fs.writeFileSync(statePath, stateContent, 'utf8');

const reqPath = 'D:/jhkSandBox/CODE/IndividualSavingsFlowUI/.planning/REQUIREMENTS.md';
const reqContent = `## Milestone v1.7 Requirements

### Design System (Editorial UI)
- [ ] **UI-01**: DESIGN.md 개편 (ISF 기존 컬러 팔레트 유지 + Anthropic 에디토리얼 스타일 도입)
- [ ] **UI-02**: Cream Canvas 배경, Serif(Display) + Sans(Body) 조합의 폰트 스택 적용
- [ ] **UI-03**: Button, Input, Card 등 핵심 컴포넌트 신규 디자인 룰 적용

### Core Features
- [ ] **CORE-01**: 다중 계좌 매핑 기능(입출금, 예적금, 투자 계좌 등) 데이터 모델 확장
- [ ] **CORE-02**: Sankey Chart 노드에 다중 계좌 데이터 연동 로직 추가
- [ ] **CORE-03**: 계좌별 잔고 분배 및 이체 내역 관리 UI 구현

### User Experience
- [ ] **UX-01**: 입력 폼 전면 개편(가독성 향상 및 여백, 타이포그래피 개선)
- [ ] **UX-02**: Step 별 화면 전환 시 부드러운 트랜지션 애니메이션 적용

### Traceability
*(To be mapped in ROADMAP.md)*
`;
fs.writeFileSync(reqPath, reqContent, 'utf8');
console.log('Files updated successfully.');
