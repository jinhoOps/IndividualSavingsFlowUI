---
type: node
created: 2026-04-14
status: seedling
tags: [history, changelog]
---

# 📜 Project History (프로젝트 업데이트 이력)

IndividualSavingsFlowUI 프로젝트의 주요 변경 사항 및 기술적 진화 이력입니다.

## 🚩 최근 주요 마일스톤

### 🟢 2026-04-15 (Current)
- **인프라 및 PWA 고도화**:
    - 백업 저장소를 IndexedDB로 확장 및 고아 데이터 삭제 동기화 로직 추가.
    - PWA 업데이트 전 자동 백업 및 버전 감지 주기 조정(포그라운드 복귀 시 체크).
    - 단일 레포 다중 단계 구조(`apps/step1`, `apps/step2`, `shared`) 및 공통 IndexedDB 허브 스키마 정착.
- **UI/UX 및 접근성 개선**:
    - 모바일 환경 CSS 재구성 및 뒤로가기 종료 UX 개선.
    - 입력값 설정 탭 네비게이션 및 항목 정렬(금액/이름) 기능 추가.
    - Sankey 다이어그램 하위 항목 그룹화 커스텀 기능 확장.
- **Step2 포트폴리오 강화**:
    - 공유 링크 LZ 압축 유틸리티 적용 및 종목 순서 변경(드래그 앤 드롭) 구현.
    - 종합 도넛 차트 가시성 개선(소수 항목 그룹화).
- **안정성 및 버그 수정**:
    - Step1->Step2 브리지 데이터 기록 안정화 및 페이지 이동 시 도넛 렌더링 지연 오류 수정.
    - 샘플 데이터 로드 시 안전 모드(View 모드) 연동.

### ⚪ 2026-04-14
- **에이전트 중심 지식 허브 구축**: [[knowledge-harness]] 도입 및 `.gemini/knowledge/` (raw/wiki/output) 구조 정착.
- **Antigravity 연동 강화**: `UPDATE.md`를 위키 체계로 마이그레이션.

### 🟡 2026-04-11 (v0.2.3)
- **에이전트 연동 초기 설정**: `.gemini/` 폴더 구축 및 스킬 정의.

### 🟡 2026-03-26 (v0.2.0)
- **공통 인프라 추출**: `shared/` 모듈 통합 (Utils, Share, Backup, Pwa).
- **Step2 UX 고도화**: 드래그 앤 드롭, 도넛 차트 가시성 개선.

### 🟡 2026-03-24 (Step2 MVP 확장)
- **IndexedDB 허브 도입**: `isf-hub-db-v1` 스키마 구축 및 Step1/2 브리지 연결.

## 🛠️ 상세 이력 보관
- 모든 상세 변경 로그는 `.gemini/knowledge/raw/archive/UPDATE.md.bak`에 보존되어 있습니다.

---
*연결 노드:* [[Operating_Principles]], [[TODO]]
