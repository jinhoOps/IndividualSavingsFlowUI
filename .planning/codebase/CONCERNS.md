<!-- generated-by: gsd-doc-writer -->
# Codebase Concerns (코드베이스 주요 우려사항 및 기술 부채)

이 문서는 Individual Savings Flow UI (ISF) 프로젝트의 무결성을 유지하기 위해 지속적으로 관리하고 주의해야 할 기술적 제약 사항, 병목 지점 및 보안 고려 사항을 정의합니다.

## Critical Invariants (핵심 불변량 및 무결성)
- **단위 정합성 (Unit Consistency)**: 계산 로직에서 '원'과 '만원' 단위가 혼용될 경우 치명적인 금융 시뮬레이션 오류를 초래합니다. 모든 단위 변환은 반드시 `IsfUtils` 또는 `MoneyUtils`를 거쳐야 하며, UI 표시(만원)와 저장/계산(원) 단위를 명확히 분리해야 합니다.
- **물리적 무결성 (Physical Integrity)**: AI 에이전트의 편집 과정에서 대규모 파일(예: `app.js`, `styles.css`)이 절삭(truncation)될 위험이 있습니다. 특히 파일 하단의 미디어 쿼리나 유틸리티 함수가 유실되지 않도록 외과적 수정(Surgical Edit) 원칙을 준수해야 합니다.
- **버전 동기화 (Triple Sync)**: 패치 또는 기능 추가 시 `package.json`, `sw.js`, `manifest.webmanifest`, `utils.js`의 버전 정보를 반드시 일치시켜야 PWA 캐시 갱신 및 데이터 정합성이 보장됩니다.

## Technical Debt (기술 부채)
- **하이브리드 아키텍처 유지관리 (Hybrid Architecture Maintenance)**: 바닐라 JS(Step 1-3)와 React/TS(Step 4)가 공존하는 "Modern Hybrid" 구조로 인해 개발 컨텍스트 스위칭 비용이 발생합니다. 두 환경 간의 상태 관리 방식 차이와 `CompatibilityBridge`를 통한 데이터 동기화 로직의 복잡성을 관리하는 것이 주요 도전 과제입니다.
- **직접적 DOM 바인딩 (Direct DOM Binding)**: 레거시 코드의 `dom.js` 및 `app.js`는 특정 HTML ID와 강하게 결합되어 있습니다. UI 구조 변경 시 이러한 바인딩이 깨질 위험이 높으며, 점진적으로 웹 컴포넌트나 리액트 컴포넌트로의 이관이 필요합니다.
- **거대 파일 (Large Files)**: `app.js`와 `styles.css`의 크기가 지속적으로 증가하고 있습니다. 주요 진입점의 모듈화와 기능별 분리가 지연될 경우 유지보수 난이도가 급격히 상승할 우려가 있습니다.
- **타입 안정성 공백 (Type Safety Gap)**: TypeScript가 도입되었으나, 레거시 JS 모듈과 연동되는 경계면에서 타입 정의 미비로 인한 런타임 에러 가능성이 존재합니다.

## Performance (성능 병목)
- **시각화 오버헤드 (Visualization Overhead)**: Sankey 다이어그램이나 대규모 차트 렌더링 시 SVG 생성 및 Recharts 처리가 메인 스레드 성능에 영향을 줄 수 있습니다. 빈번한 상태 업데이트 시 계산 엔진에 디바운싱(Debouncing) 적용이 필요합니다.
- **IndexedDB 및 스토리지 팽창 (Storage Bloat)**: 12시간 주기의 자동 백업 기능으로 인해 IndexedDB 용량이 과도하게 늘어날 수 있습니다. 오래된 백업 데이터의 자동 정리(Pruning) 정책 도입을 검토해야 합니다.

## Security (보안 고려 사항)
- **데이터 프라이버시 (Data Privacy)**: 본 앱은 Local-first 원칙을 따르며 모든 민감 정보는 사용자의 브라우저에만 저장됩니다. 하지만 URL 해시(#s)를 통한 데이터 공유 시, 민감 정보가 브라우저 히스토리에 남거나 의도치 않게 노출될 위험이 있습니다. 공유 데이터의 암호화 또는 유효기간 설정을 고려해야 합니다.
- **입력값 정제 (Input Sanitization)**: 공유 링크의 이름이나 사용자 입력 필드를 통해 XSS 공격이 시도될 수 있습니다. `input-sanitizer.js`가 모든 사용자 입력 접점에서 예외 없이 작동하도록 감시해야 합니다.

## Infrastructure Verification (인프라 검증 사항)
- 현재 프로덕션 배포 환경의 보안 설정은 저장소 내 설정만으로 완전히 검증할 수 없습니다. <!-- VERIFY: 프로덕션 배포 환경의 보안 헤더(CSP 등) 설정 상태 -->
- 데이터 허브를 통한 외부 백업/복원 기능 작동 시 데이터 무결성을 정기적으로 확인해야 합니다. <!-- VERIFY: DataHubModal의 백업 파일 호환성 및 무결성 검증 프로세스 -->
