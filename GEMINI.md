# Individual Savings Flow UI (ISF) - Project Context

이 문서는 IndividualSavingsFlowUI 프로젝트의 구조와 운영 원칙을 정의하는 에이전트 전용 인덱스입니다. 모든 에이전트는 작업 시작 전 이 문서를 통해 프로젝트의 맥락을 동기화합니다.

## 🎯 프로젝트 사명
개인 저축 및 투자 흐름을 시각화하고 최적화하는 No-build 기반의 경량 웹 애플리케이션입니다. 사용자 데이터를 안전하게 로컬에 보관하며, 단계별(Step1/2) 데이터 브리지를 통해 통합된 투자 가이드를 제공합니다.

## 🏛️ 아키텍처 원칙 (No-build Vanilla JS)
- 순수 웹 표준: 빌드 도구 없이 브라우저에서 즉시 실행 가능한 ES6 Modules 및 Vanilla JS를 유지합니다.
- Shared 우선: 기능 구현 전 shared/ 디렉토리의 공용 자산(utils, storage, components) 재활용 여부를 필수로 검토합니다.
- 데이터 로컬리티: IndexedDB(isf-hub-db-v1)와 PWA 기술을 활용하여 오프라인 가용성과 데이터 주권을 보장합니다.

## 📂 주요 디렉토리 인덱스

### 1. Applications (apps/)
- apps/step1/: 나의 가계 흐름(만원 단위) 시뮬레이션 및 현금 흐름 분석.
- apps/step2/: 투자 포트폴리오(원 단위) 설계 및 자산 배분 전략.

### 2. Shared Modules (shared/)
- shared/core/: 유틸리티, 공유 함수, 압축 알고리즘.
- shared/storage/: IndexedDB 인터페이스, 백업 관리자, 데이터 브리지.
- shared/pwa/: 서비스 워커 및 PWA 가용성 제어.
- shared/components/: 공통 UI 컴포넌트 (FeedbackManager 등).
- shared/styles/: CSS 변수 기반의 통합 테마 시스템.

### 3. Agent Knowledge Base (.gemini/knowledge/)
- .gemini/knowledge/raw/: 처리 대기 중인 원본 데이터 및 스크랩.
- .gemini/knowledge/wiki/: 정제 및 연결된 프로젝트 지식 노드.
- .gemini/knowledge/output/: 에이전트가 생산한 최종 결과물.

## 🛠️ 핵심 워크플로우

### 지식 관리 (The Librarian Workflow)
- Gather (.gemini/knowledge/raw/) -> Refine (.gemini/knowledge/wiki/) -> Archive (raw/archive/) -> Link (Wiki Nodes)

### 에이전트 협업 (Collaboration Loop)
- isf-planner (기획/설계) -> isf-developer (구현/리팩터링) -> isf-evaluator (검증/품질 보증)

## 🔗 주요 참조 문서
- 프로젝트 하네스: [[.gemini/skills/isf-harness/SKILL]]
- 운영 원칙: [[.gemini/knowledge/wiki/Operating_Principles]]
- 업데이트 이력: [[.gemini/knowledge/wiki/Project_History]]
- 기능 백로그: [[TODO.md]]

---
*모든 문서는 한국어(존댓말), UTF-8, 굵게/기울임 표시 지양 규칙을 준수합니다.*
