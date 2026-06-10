# Project Retrospective

## Milestone: v1.0 — 템플릿 기반 자산 흐름 시각화

**Shipped:** 2026-05-03
**Phases:** 3 | **Plans:** 3

### What Was Built
1. 연봉/투자 성향 프리셋 선택 UI 및 표준 자산 흐름 즉시 시각화
2. 세부 항목 수동 편집기 및 Sankey Diagram 실시간 재렌더링
3. 프리셋 적용 시 고급 설정 자동 확장/스크롤/하이라이트 UX 플로우
4. 12대 세부 항목 기반 고해상도 템플릿 엔진
5. IndexedDB 영속성 및 단위 정합성(만원/원) 완벽 수호

### What Worked
- 선 템플릿 → 후 편집 UX 패턴이 입력 피로도를 극적으로 줄여줌
- No-build Vanilla JS 아키텍처 덕분에 빠른 반복과 디버깅이 가능했음
- Phase 2.1 삽입(INSERTED)으로 감사 결과를 즉시 반영하는 유연한 워크플로우 확인
- BEM/Snake 명명 규칙과 3계층 아키텍처가 코드 일관성을 유지하는 데 크게 기여

### What Was Inefficient
- Phase 2에서 VERIFICATION.md를 별도로 작성하지 않아 감사 시 tech debt로 기록됨
- REQUIREMENTS.md의 체크박스 일부가 수동 갱신 누락되어 최종 감사에서 발견됨

### Patterns Established
- 프리셋 적용 시 자동 확장/포커스/하이라이트 3단계 UX 패턴
- distributeAmount 헬퍼를 통한 반올림 오차 보정 패턴
- 단위 변환 유틸리티(IsfUtils.toWon/toMan) 일관 활용 패턴

### Key Lessons
- 감사(audit)를 마일스톤 중간이 아닌 초기에 실행하면 Phase 삽입 비용을 줄일 수 있음
- 각 Phase 완료 시 REQUIREMENTS.md 체크박스를 즉시 갱신하는 습관이 필요함
- 데이터 품질은 기능 구현만큼 중요함 (단일 항목 → 12대 항목으로 현실감 크게 향상)

### Cost Observations
- Sessions: ~8회
- Timeline: 4일 (집중 개발)
- Notable: Phase 2.1이 코드 변경 최소(presets.js 단일 파일)로 높은 사용자 가치를 전달

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 3 |
| Plans | 3 |
| Timeline | 4 days |
| Key Pattern | 선 템플릿 → 후 편집 UX |
