---
type: node
created: 2026-04-14
status: budding
tags: [plan, step1, roadmap]
---

# 🗺️ Step1: 나의 가계 흐름 개발 계획 (Roadmap)

기준 시점: 2026-03-26 (v0.2.0 전후)

## 1) 현재 상태 요약
- **입력/계산**: 수입/생활비/저축/투자 편집, 그룹화, 만기 해지월 반영.
- **시각화**: Sankey 다이어그램 (금액/비율, 그룹 depth 반영).
- **데이터**: `sid` 포인터 + `#s` 압축 해시 기반 공유 및 IndexedDB 자동 백업.
- **PWA**: 오프라인 가용성 및 버전 체크 시스템 가동 중.

## 2) 핵심 기술 부채 및 개선 과제
- `S1-TD1`: `apps/step1/app.js` 모듈 분리 (리팩터링 필요).
- `S1-UX1`: 모바일 Sankey 가로 모드 및 화면 맞춤 UX 개선. [[TODO]]
- `S1-UX2`: 목돈성 상품(파킹통장 등)을 위한 잔액 중심 모델 도입 검토.

## 3) 안정화 체크리스트
- [ ] 항목 변경 후 데이터 정합성 유지 (Apply -> Reload).
- [ ] 공유 링크(`sid`) 만료 및 fallback(`#s`) 복원 케이스 검증.
- [ ] 12시간 주기 자동 백업 및 60개 제한 정책 작동 확인.

## 4) 우선순위 및 실행 전략
| ID | 우선순위 | 구분 | 상세 내용 |
| :--- | :--- | :--- | :--- |
| S1-H1 | High | Sankey 화면맞춤 | [완료] 모바일 0.65 배율 및 orientationchange 리셋 반영 |
| S1-H2 | High | 목돈성 상품 입력 모델 | 초기원금+추가납입 모델 시뮬레이션 반영 |
| S1-M1 | Med | app.js 모듈 분리 | [진행] v0.2.5에서 기본적인 피드백/상태 관리 모듈화 진행 |
| S1-TD1 | Med | Sankey 정합성 | [완료] 결손 노드(Deficit) 도입으로 Total In=Out 보장 |

---
*연결 노드:* [[Plan_Step2]], [[Operating_Principles]], [[Project_History]]
