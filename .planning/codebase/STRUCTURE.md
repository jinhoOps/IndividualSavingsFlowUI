# 코드베이스 구조 (Codebase Structure)

**분석 날짜:** 2026-05-19

## 디렉토리 레이아웃 (Directory Layout)

```
[project-root]/
├── apps/               # 단계별 애플리케이션 로직 (Vanilla JS 기반)
│   ├── step1/          # 개인 자산 흐름 계획 (입력 및 시각화)
│   ├── step2/          # 포트폴리오 조정 및 세부 시뮬레이션
│   └── step3/          # 대시보드 및 KPI 요약
├── shared/             # 공통 컴포넌트 및 로직
│   ├── components/     # 재사용 가능한 Web Components (AppHeader, DataHubModal)
│   ├── core/           # 공통 유틸리티, 파서, 금융 상수
│   ├── storage/        # 저장소 추상화 및 백업 관리자
│   └── styles/         # 공유 CSS 테마 및 변수
├── src/                # 현대화된 TypeScript/React 소스
│   ├── core/           # 현대화된 저장소 엔진 및 모델 정의
│   ├── entries/        # Vite 엔트리 포인트 (각 step 연결)
│   └── styles/         # 전역 스타일 설정
├── public/             # 정적 자산 및 마켓 데이터
│   ├── data/           # 역사적 시장 지수 데이터 (JSON)
│   └── icons/          # PWA 아이콘
├── scripts/            # 데이터 처리 및 유지보수용 스크립트 (Python/JS)
└── .planning/          # 프로젝트 로드맵 및 코드베이스 문서화
```

## 디렉토리 상세 역할 (Directory Purposes)

**apps/:**
- 목적: 애플리케이션의 각 단계별 주 로직을 담고 있습니다.
- 내용: `app.js`, `index.html`, `styles.css` 및 모듈화된 로직(`modules/`).
- 주요 파일: `apps/step1/app.js`, `apps/step1/modules/calculator.js`.

**shared/:**
- 목적: Vanilla JS와 TypeScript 환경 모두에서 공통으로 사용하는 자원을 관리합니다.
- 내용: Web Components, 전역 유틸리티, 스토리지 핸들러.
- 주요 파일: `shared/components/data-hub-modal.js`, `shared/storage/hub-storage.js`.

**src/:**
- 목적: TypeScript 기반의 현대화된 빌드 환경 소스입니다.
- 내용: 새로운 IndexedDB 기반 스토어 및 데이터 모델 정의.
- 주요 파일: `src/core/storage/IsfStore.ts`, `src/core/storage/CompatibilityBridge.ts`.

**public/data/:**
- 목적: 시뮬레이션에 필요한 대규모 정적 데이터셋을 보유합니다.
- 내용: KOSPI, S&P 500 등 역사적 가격 정보를 담은 JSON 파일.

## 주요 파일 위치 (Key File Locations)

**엔트리 포인트 (Entry Points):**
- `src/entries/step1.ts`: Step 1 초기화 및 번들링 엔트리.
- `src/entries/step3.ts`: Step 3 초기화 및 번들링 엔트리.

**설정 파일 (Configuration):**
- `vite.config.ts`: 빌드 및 개발 서버 설정.
- `package.json`: 의존성 관리 및 실행 스크립트.

**핵심 로직 (Core Logic):**
- `apps/step1/modules/calculator.js`: Step 1 자산 흐름 계산 엔진.
- `shared/core/utils.js`: 전역 금융 계산 및 단위 변환 유틸리티.

**테스트 (Testing):**
- `shared/core/clipboard-parser.test.js`: SMS/클립보드 파싱 유닛 테스트.

## 명명 규칙 (Naming Conventions)

**파일 (Files):**
- Vanilla 모듈: `kebab-case.js` (예: `input-sanitizer.js`)
- TypeScript 클래스: `PascalCase.ts` (예: `IsfStore.ts`)
- 스타일: `kebab-case.css` 또는 `step-theme.css`

**디렉토리 (Directories):**
- 일반: `kebab-case` (예: `data-hub-modal`)

## 코드 추가 가이드 (Where to Add New Code)

**새로운 기능 (Step 1-3):**
- 비즈니스 로직: `apps/step[N]/modules/`
- UI 요소: `apps/step[N]/index.html` 또는 `shared/components/` (Web Component)

**공통 유틸리티:**
- 범용 헬퍼: `shared/core/utils.js`

**데이터 저장/영속화 관련:**
- 스키마 정의: `src/core/types/models.ts`
- 저장소 로직: `src/core/storage/IsfStore.ts`

## 특수 디렉토리 (Special Directories)

**.planning/:**
- 목적: 프로젝트 상태, 요구사항, 코드베이스 분석 문서.
- 관리: 에이전트에 의해 수동 관리 및 업데이트.

**scripts/:**
- 목적: 마켓 데이터 수집 및 정제 자동화.
- 언어: 주로 Python(`*.py`)과 Node.js(`*.js`) 사용.

---

*구조 분석: 2026-05-19*
