# Phase 09: Newlywed Harmony Hub (신혼부부 통합 허브)

## 📌 Context Overview
신혼부부 또는 동거 파트너 간의 각자 관리되던 현금 흐름을 하나의 통합된 뷰로 병합하고, 일상적인 지출 입력의 번거로움을 해결하기 위한 'Smart Clipboard Parser' 기능을 제공합니다.

## 🎯 Goals
1. **입력 편의성 극대화**: 은행 결제 문자나 앱 알림 내용을 복사하여 붙여넣으면 자동으로 카테고리와 금액을 인식하는 파서 구현.
2. **데이터 통합**: 부부 각자의 ISF 데이터를 안전하게 병합하여 전체 가계의 Sankey Diagram 및 자산 추이를 시각화.
3. **독립성 유지**: 통합 뷰를 제공하되, 개인별 데이터의 독립적인 관리도 가능하도록 설계.

## 🧩 Key Features
- **Smart Clipboard Parser**: 
  - 정규표현식(Regex) 기반의 다중 은행/카드사 포맷 지원.
  - 날짜, 상호명, 금액 자동 추출 및 기존 지출 카테고리 매핑 추천.
- **Dual-Flow Merge**:
  - 두 사용자의 ISF 데이터(Snapshots)를 해시 기반으로 병합.
  - 통합 Sankey Diagram 렌더링 (Shared Layout).
  - 중복 항목 처리 및 수입/지출 합산 로직.

## 🛠 Tech Stack
- **Parsing Engine**: Pure JavaScript (Regex & String Manipulation).
- **UI Component**: React 19 (for Harmony Hub Dashboard).
- **Data Bridge**: `IsfShare` 모듈 확장 (Multi-payload support).

## 📈 Success Criteria
1. 주요 3개 이상 은행/카드사 결제 문자 파싱 성공률 95% 이상.
2. 두 개의 서로 다른 데이터 세트가 충돌 없이 하나의 통합 시뮬레이션 결과로 합산됨.
3. 모바일에서 클립보드 복사-붙여넣기-적용으로 이어지는 UX가 3초 이내에 완료됨.
