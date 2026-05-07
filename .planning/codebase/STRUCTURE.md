<!-- generated-by: gsd-doc-writer -->
# 디렉토리 구조 (Directory Structure)

본 프로젝트는 단일 저장소(Monorepo) 스타일의 다중 단계(Step) 구조로 설계되었으며, 레거시 JavaScript와 최신 TypeScript/React가 공존하는 구조로 운영됩니다.

## 🏗️ 주요 디렉토리 개요

```text
root/
├── apps/                 # 단계별 애플리케이션 진입점 (HTML/Assets)
│   ├── step1/           # 1단계: 나의 가계 흐름 (Sankey Diagram)
│   ├── step2/           # 2단계: 포트폴리오 투자 (MVP)
│   ├── step3/           # 3단계: KPI 대시보드 및 자산 추이
│   └── step4/           # 4단계: 시뮬레이션 및 정교화 (React 기반)
├── shared/               # 여러 단계에서 공용으로 사용하는 리소스 (Legacy & Common)
│   ├── components/      # 공통 웹 컴포넌트 (Header, Modal 등)
│   ├── core/            # 핵심 유틸리티 (Calculation, Share, Common)
│   ├── storage/         # IndexedDB 스키마 및 데이터 영속성 관리
│   ├── styles/          # 공통 테마 및 CSS 변수
│   ├── pwa/             # 서비스 워커 및 PWA 관리
│   └── legacy/          # 구버전 호환 리소스
├── src/                  # Vite 빌드 대상 TypeScript/React 소스 코드
│   ├── entries/         # 각 단계별 메인 스크립트 진입점 (step1.ts ~ step4.tsx)
│   ├── components/      # React 기반 공통 UI 컴포넌트
│   ├── core/            # TypeScript 기반 비즈니스 로직 및 타입 정의
│   └── styles/          # Tailwind CSS 등 최신 스타일 시트
├── .planning/            # GSD 방법론 기반 프로젝트 계획 및 상태 문서
│   ├── codebase/        # 아키텍처, 구조, 컨벤션 등 코드베이스 설계 문서
│   ├── milestones/      # 주요 버전별 마일스톤 및 감사 결과
│   └── phases/          # 단계별 작업 계획 (PLAN, SUMMARY, RESEARCH 등)
├── knowledge/            # 프로젝트 위키 및 도메인 지식 베이스 (Wiki)
├── public/               # 정적 자산 (PWA 아이콘, 매니페스트, 데이터 인덱스)
├── scripts/              # 빌드 보조 및 버전 동기화 스크립트
├── DESIGN.md             # 디자인 시스템 토큰 및 명세
├── GEMINI.md             # 프로젝트 헌법 및 에이전트 라우터
└── package.json          # 프로젝트 의존성 및 스크립트 (v0.9.15)
```

## 📂 상세 설명

### 1. apps/
각 단계의 독립적인 진입점입니다. 각 디렉토리의 `index.html`은 `src/entries/`에 위치한 해당 단계의 메인 스크립트를 참조하여 실행됩니다.

### 2. shared/
프레임워크에 의존하지 않는 순수 JavaScript 및 CSS 리소스입니다. Web Components 기술을 활용하여 단계 간 UI 일관성을 유지하며, 브라우저 스토리지 연동 등 핵심 인프라 로직을 공유합니다.

### 3. src/
현대적인 개발 환경을 위한 소스 코드입니다. TypeScript와 React를 사용하며, Vite 빌드 파이프라인을 통해 최적화된 결과물로 변환됩니다. 특히 데이터 흐름이 복잡한 4단계 시뮬레이션의 핵심 로직을 포함합니다.

### 4. .planning/
프로젝트의 설계 사상, 마일스톤, 현재 상태 및 작업 이력을 관리합니다. 에이전트들이 작업의 맥락을 파악하고 무결성을 유지하기 위한 지도로 활용됩니다.

### 5. knowledge/
금융 지식, 세제 정보, 에이전트 행동 지침 등을 문서화한 지식 저장소입니다. `wiki-librarian` 스킬을 통해 지속적으로 관리 및 확장됩니다.
