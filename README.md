# IndividualSavings Flow UIUX (v0.9.x)

`개인 자산 흐름 (IndividualSavings Flow UIUX)` 프로젝트는  
개인의 월간 현금흐름 점검부터 중장기 자산 변화 시뮬레이션까지 연결하는 UIUX를 기획 중입니다.  
**Modern Hybrid (Vite/TS/Tailwind v4)** 기반의 고성능 금융 시뮬레이션 환경을 지향합니다.

## 구조

- `apps/step1`: `나의 가계 흐름` (현재 운영중인 1단계, 온보딩 지원)
- `apps/step2`: `배당 성장 시뮬레이션` (자산 성장/배당 재투자/성장률 시뮬레이션)
- `src/core`: 현대화된 TypeScript 기반 핵심 로직 (스토리지 v2, 브랜디드 타입)
- `shared`: 레거시 및 공통 UI 컴포넌트

## Tech Stack & Philosophy

- **Modern Hybrid (Vite/TS/Tailwind v4)**: 현대적 DX를 구축하되 브라우저 표준 기술과의 상호운용성을 보존합니다.
- **System Integrity**: TypeScript를 통한 단위(원/만원) 정합성 수호 및 `IsfStore` 기반의 타입 안전한 데이터 관리.
- **Financial Precision**: 4% 안전 마진이 적용된 금융소득종합과세 경고 및 누진세율 기반 세액 계산 엔진 탑재.
- **Mobile-First & Glassmorphism**: PWA 환경에 최적화된 유려한 디자인 시스템과 반응형 레이아웃.
- **LLM Wiki (Compounding Knowledge)**: 모든 설계와 결정은 프로젝트 내부 위키에 합성되어 복리로 축적됩니다.

## 문제 정의

- 월 수입/지출 정보를 여러 앱에 나눠 관리하면 이번 달 돈의 흐름을 한눈에 보기 어렵습니다.
- 특히 "얼마를 벌고, 어디에 썼는지"를 빠르게 점검하기 어려워 가계 판단이 늦어집니다.

## 배포 페이지에서 바로 사용

- 접속:
  - 루트(자동 Step1 이동): https://jinhoops.github.io/IndividualSavingsFlowUI/
  - Step1 직접: https://jinhoops.github.io/IndividualSavingsFlowUI/apps/step1/
  - Step2 직접: https://jinhoops.github.io/IndividualSavingsFlowUI/apps/step2/
- 금액 단위: `만원` (UI 표시), `원` (내부 계산 및 저장)
- 기본 흐름:
  1. `Spotlight 온보딩`을 통해 서비스 사용법 및 프리셋 탐색
  2. `입력값`에서 수입/지출/저축/투자/부채상환 값을 입력
  3. `적용`으로 반영 후 핵심 카드 + Sankey Diagram + 계산 검증표 확인
  4. Step 2로 이동하여 자동 연동된 투자 여력 기반 배당 성장 시뮬레이션 수행

## 현재 기능

- **Step 1: 나의 가계 흐름**
  - 신규 사용자를 위한 `Spotlight` 온보딩 가이드 시스템
  - 수입/지출/저축/투자 상세 항목 편집 및 Sankey 시각화
  - 가계 추이 계산 검증표 및 실질 순자산(현재가치) 표시
  - 금융소득종합과세 **4% 안전 마진 경고** (1,920만/3,264만 기준)

- **Step 2: 배당 시뮬레이션**
  - 자산 성장률(CGR), 배당 성장률(DGR), 배당 재투자(DRIP) 시뮬레이션 엔진
  - 인플레이션 반영 실질 가치 연산 및 시계열 차트/테이블 시각화
  - Step 1 데이터 자동 연동 (월 투자여력 및 초기 자산 연동)

- **데이터 및 인프라**
  - PWA 지원: 오프라인 사용 및 홈 화면 추가 지원
  - 스토리지 v2: IndexedDB `isf-v2-db` 기반의 타입 안전한 CRUD
  - 로컬/원격 백업: 12시간 자동 백업 및 공유 링크(sid/hash) 지원

## 저장 방식

- **우선순위**: `공유 포인터(sid)` -> `URL 해시(#s)` -> `localStorage` -> 기본값
- **스토리지 v2 (src/core/storage)**:
  - `IsfStore.ts`: TypeScript 기반 고성능 IndexedDB 래퍼
  - `BackupService.ts`: 현대화된 자동/수동 백업 프로토콜
- **단위 정책**: UI는 `만원`(예: 350 만원), 영속화 데이터는 `원`(예: 3,500,000) 단위 고수
- **Compatibility Bridge**: 레거시 앱이 수정 없이 신규 스토리지 레이어를 사용하도록 브릿지 제공

## 로컬 개발 및 실행

본 프로젝트는 Vite 빌드 시스템을 사용합니다.

```bash
# 저장소 복제
git clone https://github.com/jinhoOps/IndividualSavingsFlowUI.git
cd IndividualSavingsFlowUI

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드 및 프리뷰
npm run build
npm run preview
```
