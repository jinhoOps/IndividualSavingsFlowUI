# Main 저축·투자 금액 편집 연결

월 저축·월 투자 금액을 누르면 기존 월 금액 편집기를 열고 해당 입력란에 초점을 둔다. 명칭·비율과 도넛의 탐색 동작은 유지한다. 같은 편집기가 열려 있으면 입력값을 보존하며 초점만 옮긴다. 닫기는 진입 금액으로 초점을 복원하고, 공통 월 금액 편집은 기존 기본 초점을 사용한다. 열기만으로 dirty·서버 저장을 만들지 않는다.

변경: CashflowSummary/CashflowDonutSummary의 금액 행동, SummaryDashboard의 요청 초점, Main CSS의 아이콘 없는 금액 버튼. [DESIGN](../../../DESIGN.md)과 [PRD](../../ways-of-work/plan/isf-rebuild/connected-financial-planning-workspace/prd.md)에 계약을 반영했다. MainPlanEditor·workspace schema·RPC는 변경하지 않았다.

검증:
- 최종 `NODE_OPTIONS=--no-experimental-webstorage npm run check:ci`: harness·TypeScript, 145개 파일·1,341개 unit test 통과.
- `npx playwright test tests/main-react.spec.ts tests/account-workspace.spec.ts --grep 'main|Main|dashboard'`: 55개 통과.
- 390/768/1280px에서 금액 버튼 44px 이상, Enter/클릭 진입, 선택 입력란·조정 버튼 표시, viewport containment·overflow, Escape 후 초점 복귀, 일반 편집 기본 초점, 실제 값 적용 확인.
- 0원 진입과 열기만으로 저장하지 않음, 데스크톱 키보드로 열린 편집기의 항목 전환 시 draft 보존을 검증했다.
- 기존 편집 버튼 개수와 새 버튼의 접근성 이름에 따른 테스트 충돌을 갱신했다. 사이드 패널에 가려진 배경 금액을 마우스로 누르는 테스트는 실제 가능한 키보드 경로로 교정했다.
- `git diff --check`, 변경 문서 상대 링크 확인 통과.

실제 설치형 모바일 키보드의 시각 viewport 변화는 자동화 viewport 검증 범위 밖이다. 데이터 저장 계약은 기존 Main 경로를 그대로 사용한다.
