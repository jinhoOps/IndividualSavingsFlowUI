<!-- refreshed: 2026-05-19 -->
# 아키텍처 (Architecture)

**분석 날짜:** 2026-05-19

## 시스템 개요 (System Overview)

```text
┌─────────────────────────────────────────────────────────────┐
│                      애플리케이션 엔트리                      │
│  `src/entries/step[1-3].ts` -> `apps/step[1-3]/index.html`  │
├──────────────────┬──────────────────┬───────────────────────┤
│    Step 1 (JS)   │    Step 2 (JS)   │    Step 3 (JS)        │
│  `apps/step1`    │  `apps/step2`    │   `apps/step3`        │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    비즈니스 로직 계층 (Logic)                 │
│  `apps/step*/modules/*.js` (Modular Vanilla JS)             │
│  `shared/core/*.js` (Common Utilities)                      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    저장소 및 데이터 계층 (Storage)             │
│  `src/core/storage/IsfStore.ts` (IndexedDB)                 │
│  `shared/storage/hub-storage.js` (Bridge/Legacy)            │
│  `public/data/indices/*.json` (Market Data)                 │
└─────────────────────────────────────────────────────────────┘
```

## 컴포넌트 역할 (Component Responsibilities)

| 컴포넌트 | 역할 | 파일 경로 |
|-----------|----------------|------|
| **App Orchestrator** | 모듈 간 조정 및 DOM 이벤트 핸들링 | `apps/step[1-3]/app.js` |
| **Logic Modules** | 금융 계산, 입력 정제, 상태 관리 헬퍼 | `apps/step[1-3]/modules/*.js` |
| **IsfStore** | 현대화된 IndexedDB 기반 상태/이력 저장소 | `src/core/storage/IsfStore.ts` |
| **Compatibility Bridge**| 레거시 JS 코드를 현대화된 TS 서비스와 연결 | `src/core/storage/CompatibilityBridge.ts` |
| **Shared Components** | 공통 UI 요소 (Web Components) | `shared/components/*.js` |
| **PwaManager** | 서비스 워커 및 PWA 생명주기 관리 | `shared/pwa/pwa-manager.js` |

## 패턴 개요 (Pattern Overview)

**전체 구조:** 하이브리드 아키텍처 (현대적 빌드 시스템 + 점진적 강화)

**주요 특징:**
- **3계층 구조 (State/Helper/UI):** `GEMINI.md` 원칙에 따라 상태, 비즈니스 로직, UI 핸들러를 엄격히 분리.
- **No-build 가용성:** `apps/` 폴더 내의 코드는 브라우저에서 즉시 실행 가능한 순수 JS/CSS/HTML 구조를 유지.
- **단위 정합성 (Unit Consistency):** UI 표시는 '만원', 내부 계산 및 저장은 '원' 단위를 유지하는 명확한 변환 계층 존재.

## 레이어 (Layers)

**UI 계층 (UI Layer):**
- 목적: 사용자 상호작용 및 데이터 시각화.
- 위치: `apps/step[1-3]/`, `shared/components/`.
- 내용: HTML 템플릿, CSS, Vanilla DOM 조작, Web Components.
- 의존성: 로직 계층, 저장소 계층.

**로직 계층 (Logic Layer):**
- 목적: 금융 계산 및 데이터 변환.
- 위치: `apps/step*/modules/`, `shared/core/`.
- 내용: `calculator.js`, `input-sanitizer.js`, `comparison-engine.js`.
- 의존성: 공유 유틸리티.

**저장소 계층 (Storage Layer):**
- 목적: 데이터 영속성 및 무결성 보장.
- 위치: `src/core/storage/`, `shared/storage/`.
- 내용: IndexedDB 스키마, LocalStorage 래퍼, 백업 매니저.
- 의존성: 공유 유틸리티.

## 데이터 흐름 (Data Flow)

### 기본 요청 경로 (Step 1-3)

1. **사용자 입력:** `apps/step*/app.js`에서 DOM 이벤트를 감지.
2. **입력 정제:** `modules/input-sanitizer.js`를 통해 유효성 검사 및 '원' 단위 변환.
3. **계산 로직:** `modules/calculator.js`에서 금융 시뮬레이션 및 데이터 가공.
4. **상태 업데이트:** `modules/state.js`에 결과 저장 및 `IsfStorageHub`/`IsfStore`를 통해 영속화.
5. **UI 렌더링:** `sankey-renderer.js` 등 전용 렌더러를 통해 화면 갱신.

**상태 관리 (State Management):**
- **Vanilla:** `modules/state.js`의 지역 `state` 객체 및 `helpers.markDirty` 패턴 사용.
- **영속화:** 현대화된 IndexedDB (`IsfStore`)와 `localStorage`를 동기화하여 사용.

## 주요 추상화 (Key Abstractions)

**IsfStore:**
- 목적: 모든 단계의 데이터를 통합 관리하는 중앙 집중식 저장소.
- 위치: `src/core/storage/IsfStore.ts`
- 패턴: Repository Pattern.

**Compatibility Bridge:**
- 목적: 레거시 Vanilla JS와 현대적인 TypeScript 서비스 간의 통신 보장.
- 위치: `src/core/storage/CompatibilityBridge.ts`
- 패턴: Adapter/Bridge Pattern.

## 엔트리 포인트 (Entry Points)

**Step 1-3 엔트리:**
- 위치: `src/entries/step[1-3].ts`.
- 트리거: Vite 빌드 프로세스, `apps/step*/index.html`에서 로드.
- 역할: 앱 초기화, 공유 스타일 로드, Web Components 마운트.

## 아키텍처 제약 사항 (Architectural Constraints)

- **단위 정합성:** 모든 저장 데이터는 '원' 단위여야 함 (`IsfUtils.toWon` 필수 사용).
- **물리적 무결성:** CSS/HTML 수정 시 반응형 레이아웃 및 파일 하단 미디어 쿼리 보호.
- **하이브리드 지원:** Vite 빌드 없이도 `apps/` 하위 코드가 동작할 수 있도록 상대 경로 임포트 유지.

## 안티 패턴 (Anti-Patterns)

### 거대 오케스트레이터 (Large Orchestrator)
**현상:** `apps/step1/app.js`가 너무 비대해짐.
**문제:** 유지보수와 테스트가 어려워짐.
**대안:** 도메인별 로직을 `modules/` 하위의 작은 모듈(`onboarding-manager.js`, `snapshot-manager.js` 등)로 계속 추출.

## 에러 핸들링 (Error Handling)

**전략:** 안전한 기본값(Fail-safe) 제공 및 사용자 피드백.
**패턴:**
- **Sanitization:** 입력을 즉시 정제하여 계산 엔진의 크래시 방지.
- **Feedback UI:** `FeedbackManager.js`를 통한 비차단형 알림.

## 횡단 관심사 (Cross-Cutting Concerns)

**로깅:** 중요 금융 상태 변화 및 스토리지 이벤트 로깅.
**검증:** 금융종합소득과세 한도 초과 등에 대한 실시간 경고 시스템.
**PWA:** 오프라인 사용을 위한 서비스 워커 관리 (`shared/pwa/pwa-manager.js`).

---

*아키텍처 분석: 2026-05-19*
