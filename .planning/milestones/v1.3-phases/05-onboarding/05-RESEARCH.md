# Phase 5 Research: Step 1 Spotlight Onboarding

## 1. 분석 및 전략

### 기존 코드 분석
- **대상 요소**: `apps/step1/index.html` 내의 `#presetBlock`.
- **기존 강조 로직**: `styles.css`에 `is-highlighted` 클래스와 `pulse-highlight` 애니메이션이 이미 존재하여, 이를 확장하거나 유사한 톤으로 Spotlight를 구현할 수 있음.
- **데이터 상태**: `IsfStorageHub`를 통해 `localStorage` 접근이 가능하며, `onboarding-step1-preset` 키를 사용하여 노출 여부를 관리할 수 있음.

### 구현 전략
- **커스텀 Spotlight**: 외부 라이브러리(Intro.js 등) 없이 Vanilla JS와 CSS로만 구현.
- **포커싱 방식**: 거대 `box-shadow` (spread-radius 활용) 또는 `clip-path`를 이용한 오버레이 방식으로 배경을 어둡게 하고 타겟만 밝게 노출.
- **데이터 SSOT**: 온보딩 완료 상태는 `IsfStorageHub`의 `saveLocal/loadLocal`을 사용하여 관리.
