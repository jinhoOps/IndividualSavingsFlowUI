# Milestone v1.6 Requirements

## 1. Code Refactoring (REF)
- [ ] **REF-01**: `app.js` 코어 로직 무결성을 유지하며 3계층 구조(상태/헬퍼/UI) 모듈화 진행
- [ ] **REF-02**: 미사용 변수/임포트 정리 (외과적 수정)

## 2. UX Improvements (UX)
- [ ] **UX-01**: `DESIGN.md` 기반 "ISF Pearl" 캔버스와 "Glass Panel" 일관 적용
- [ ] **UX-02**: 브랜드 컬러(Sunset/Deep Sea) 규칙 전면 적용
- [ ] **UX-03**: 768px 모바일 반응형 레이아웃 파손 방지 및 UI 교정
- [ ] **UX-04**: 버튼 인터랙션(`scale(0.96)`) 및 즉각적 피드백(Pending Bar, Toast) 일관성 확보
- [ ] **UX-05**: Sankey Chart 가독성/디자인 개선 (데이터 라벨링, 간격, 컬러 등 최적화)

## 3. Stability Enhancement (STAB)
- [ ] **STAB-01**: 단위 정합성(만원/원) 수호 및 `IsfUtils` 변환 로직 전면 점검
- [ ] **STAB-02**: 금융종합소득과세(1,900만 원 초과 warn 등) 경고 로직 보강 및 물리적 무결성 점검

## 4. New Features (FEAT)
- [ ] **FEAT-01**: 이미지 내보내기(Export to Image) 기능을 통한 공유 기능 추가

## Out of Scope
- [백테스트 시뮬레이터] — `stock-snowball` 프로젝트로 이관되어 본 프로젝트에서는 다루지 않음.
- [실시간 시세 연동] — 정적 데이터 중심 아키텍처 철학 유지.

## Traceability
- **Phase 13**: REF-01, REF-02, STAB-01, STAB-02
- **Phase 14**: UX-01, UX-02, UX-04
- **Phase 15**: UX-03, UX-05
- **Phase 16**: FEAT-01
