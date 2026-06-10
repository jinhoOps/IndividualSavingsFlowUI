# Phase 5 UI Spec: Step 1 Spotlight Onboarding

## UI/UX 스펙

### 오버레이 및 Spotlight (CSS)
- **Overlay**: `.onboarding-overlay` 클래스 정의. `fixed`, `inset: 0`, `z-index: 1000`, `background: rgba(0, 0, 0, 0.7)`.
- **Spotlight Effect**: `#presetBlock`에 `.is-onboarding-active` 클래스 부여. 
  - `position: relative`, `z-index: 1001`.
  - Glassmorphism 효과를 유지하기 위해 `backdrop-filter`는 보존하되, 주변 배경만 어둡게 처리.
- **Tooltip**: `#presetBlock` 하단 또는 상단에 배치될 `.onboarding-tooltip`.
  - 배경: `var(--panel)` (Glassmorphism 적용).
  - 테두리: `1px solid var(--income)`.
  - 폰트: `var(--text-body-md)`.
  - 애니메이션: `fade-in-up 0.3s ease-out`.

### 인터랙션 흐름
1. **진입**: 페이지 로드 시 `onboarding-step1-preset` 값이 `true`가 아니면 실행.
2. **가이드 노출**: 오버레이 생성 및 `#presetBlock` 강조. 툴팁 표시.
3. **종료 조건**:
   - '프리셋 적용' 버튼(`#applyPresetBtn`) 클릭 시.
   - 툴팁 내 '나중에 하기' 또는 '닫기' 버튼 클릭 시.
4. **후속 처리**: `localStorage.setItem('onboarding-step1-preset', 'true')` 저장 및 UI 제거.

### 모바일 대응
- 760px 이하 환경에서는 프리셋 블록이 수직으로 길어지므로, 툴팁을 블록 내부에 겹치지 않게 '화면 하단 플로팅 바' 형식으로 변경 제안.
