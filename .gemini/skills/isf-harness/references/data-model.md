# Data Model & Storage

### 금액 단위 (Currency Units)
- Step1 (나의 가계 흐름): 만원 단위 사용 (예: 350 = 3,500,000원).
- Step2 (투자 포트폴리오): 원 단위 사용.
- 단계 간 데이터 이동 시 단위 변환에 주의해야 합니다.

### 저장 전략 (Storage Strategy)
우선순위에 따라 데이터를 로드합니다:
1. 공유 포인터 (sid): IndexedDB의 snapshots 테이블에서 고유 ID로 조회.
2. URL 해시 (#s): LZ 기반 압축 문자열을 디코딩하여 상태 복원.
3. 로컬 저장소 (IndexedDB): isf-hub-db-v1의 최신 상태 로드.
4. 기본값 (Default): 초기 샘플 데이터.

### IndexedDB 스키마 (isf-hub-db-v1)
- step1Snapshots: Step1의 이력 스냅샷.
- bridgeStep1ToStep2: Step1에서 Step2로 전달되는 핵심 요약 정보.
- step2Portfolios: Step2의 포트폴리오 데이터.
- backups: 12시간 주기로 저장되는 자동 백업 데이터 (최대 60개).

### 데이터 브리지
Step1의 적용 버튼 클릭 시, Step2에서 필요한 최소 페이로드(monthlyInvestCapacity, currentCash 등)가 bridgeStep1ToStep2 테이블에 저장됩니다.
