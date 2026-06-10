# Phase 5 Sprint Contract: Step 1 Spotlight Onboarding

이 계약은 Phase 5 구현을 시작하기 전, 구현 에이전트(Developer)와 사용자 간의 합의된 완료 기준(DoD)을 정의합니다.

## 1. 기술적 구현 상세

### 1.1 모듈 및 구조
- **신규 파일**: `apps/step1/modules/onboarding-manager.js`
  - 온보딩 로직을 캡슐화하여 `app.js`의 복잡도를 낮춥니다.
  - `initOnboarding`, `showStep1PresetGuide`, `markOnboardingComplete` 등의 메서드를 포함합니다.
- **연동**: `apps/step1/app.js`의 `init()` 과정에서 `onboarding-manager.js`를 호출합니다.

### 1.2 UI/UX 구현 방식
- **Spotlight 오버레이**: 
  - `::before` 또는 별도 DOM 요소를 사용하여 화면 전체를 어둡게(`rgba(0,0,0,0.6)`) 덮습니다.
  - 타겟 요소(`#presetBlock`)의 `z-index`를 높여 오버레이 위로 부상시킵니다.
- **온보딩 툴팁**:
  - Glassmorphism 스타일(`backdrop-filter`, `var(--panel)`)을 적용한 플로팅 레이어를 구현합니다.
  - 데스크톱: 요소 하단/우측에 화살표와 함께 배치.
  - 모바일: 화면 하단에 고정된 슬라이드 업 바(Slide-up Bar) 형식으로 최적화.

### 1.3 데이터 정합성
- **스토리지 키**: `isf-onboarding-step1-preset-v1`
- **관리 도구**: `shared/storage/hub-storage.js` (`IsfStorageHub`)의 표준 메서드를 사용하여 읽기/쓰기를 수행합니다.

## 2. 검증 가능한 완료 기준 (DoD)

1. **상태 기반 노출**: `localStorage`에 완료 플래그가 없을 때만 온보딩이 시작되는가?
2. **Spotlight 무결성**: 강조된 프리셋 영역 외의 다른 요소는 클릭이 차단(오버레이)되는가?
3. **종료 및 저장**: '프리셋 적용' 버튼 또는 가이드 닫기 클릭 시 UI가 제거되고 상태가 영구 저장되는가?
4. **반응형 디자인**: 760px 미만 뷰포트에서 툴팁이 화면 밖으로 나가지 않고 모바일 전용 레이아웃으로 전환되는가?
5. **디자인 시스템**: `DESIGN.md` 및 `step-theme.css`의 디자인 언어(Glassmorphism, Snake case class)와 일치하는가?
6. **No-build 준수**: 별도의 npm 패키지나 빌드 도구 없이 Vanilla JS/CSS만으로 동작하는가?

---
**계약 승인**: 위 기준에 동의하시면 구현을 시작합니다.
