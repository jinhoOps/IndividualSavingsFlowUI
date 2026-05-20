# Phase 14: Foundation UX & Branding - Validation

## Verification Checklist

본 문서는 Phase 14 구현 후 최종 신뢰도를 측정하고 보증하기 위한 검증 시나리오 명세서입니다.

### 1. Glassmorphism & Contrast Verification
- 검증 목적: DESIGN.md 규격을 만족하는 rgba(255, 255, 255, 0.9) 투명도가 모든 카드 및 패널 요소에 완전하게 스며들었는지 검증합니다.
- 검증 방법:
  - 브라우저 개발자 도구(F12)의 Styles 패널에서 .panel, .card 요소를 선택하여 background-color 값이 rgba(255, 255, 255, 0.9)로 지정되었는지 분석합니다.
  - 본문 글씨와 금융 숫자 데이터가 Glassmorphism 배경 위에서 번짐이나 흐릿함 없이 선명하게 대조를 이루고 가독성이 확보되는지 시각적으로 관측합니다.

### 2. Active Scale Feedback Motion Verification
- 검증 목적: 물리 피드백 인터랙션 범위 확장 규격이 올바르게 설계되었는지 확인합니다.
- 검증 방법:
  - 다음 요소들을 클릭하거나 모바일 터치 환경에서 누르고 있는 상태(:active)를 유지합니다:
    - 상단 AppHeader 네비게이션 링크 (.nav-link)
    - 탭 전환 버튼 (.tab-btn)
    - 플로팅 버튼 (.floating-btn)
    - 모달 닫기 버튼 (.modal-close)
    - 일반 물리 버튼 (.btn)
  - 누르고 있을 때 scale(0.96)로 즉각 수축되고 손을 떼면 원상태로 복원되는지 마이크로 프레임 햅틱 모션을 모니터링합니다.

### 3. Responsive Stack Framework Verification (<= 768px)
- 검증 목적: 768px 이하 뷰포트에서 레이아웃 파손을 완벽히 방어하는지 안전 점검을 실시합니다.
- 검증 방법:
  - 브라우저의 가로 너비를 768px 이하로 서서히 줄이며 뷰포트를 변경합니다.
  - 가로 폭이 768px에 도달하는 임계 영역에서 다음 구조적 전환이 깨짐 없이 동작하는지 파악합니다:
    - 모든 주요 패널(.panel, .card)의 안쪽 패딩(Padding)이 14px(--sp-md)로 일괄 축소되는지 점검합니다.
    - 다단 그리드 레이아웃 요소들이 1열 세로 스택 구조로 정렬이 미려하게 재구성되는지 점검합니다.

### 4. Build System Integrity Validation
- 검증 목적: Vite 인프라 내에서 스타일 정합성 및 빌드 안정성이 파괴되지 않았는지 확인합니다.
- 검증 방법:
  - CLI 환경에서 npm run build 명령어를 작동시킵니다.
  - 빌드 산출물이 정상적으로 컴파일 완료되고 빌드 로그에 문법 경고나 파싱 오류 메일링이 발견되지 않는지 무결성을 검증합니다.
