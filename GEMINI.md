# Individual Savings Flow UI (ISF) - Main Agent Router

이 리포지토리는 "Individual Savings Flow UI" 어플리케이션을 개발하고 지식을 확장하는 에이전트의 세계입니다. 모든 에이전트 작업은 ఈ 라우터(Router)의 지휘를 받습니다.

## 🚨 핵심 원칙: 시스템 무결성 (System Integrity)
**이 프로젝트에서 UI/UX와 데이터 무결성은 기능만큼 중요합니다.** 에이전트는 아래 사항을 절대적으로 준수해야 합니다.
- **스타일 및 반응형 무결성**: 
    - **물리적 무결성**: CSS/HTML 수정 시 파일 하단의 `@media` 쿼리나 유틸리티 클래스가 절삭(Truncate)되지 않도록 수정 전후의 파일 크기와 구조를 반드시 대조하십시오.
    - **반응형 우선**: 760px 이하 모바일 레이아웃이 파손되지 않았는지 Evaluator 단계에서 시각적으로 재검증해야 합니다.
    - **명명 규칙 (BEM/Snake)**: CSS 클래스는 BEM 표기법(`block__element--modifier`) 또는 단어 간 하이픈/언더스코어를 사용하는 스네이크 스타일을 일관되게 적용하여 스타일 통일성을 유지하십시오.
- **로직 보존 (Core Logic Protection)**: 
    - 리팩토링 시 `app.js`의 **3계층 구조(상태/헬퍼/UI)**를 유지하고, `markDirty` 등 14종 이상의 필수 헬퍼 함수가 소실되지 않도록 주의하십시오.
- **단위 정합성 (Unit consistency)**: 
    - **UI(만원) vs 저장/계산(원)** 규칙을 수호하십시오. 
    - 모든 사용자 입력 및 UI 표시는 **만원** 단위로 통일하십시오.
    - 모든 내부 계산 및 영속화 데이터는 **원** 단위를 유지하십시오.
    - 변환 시 `IsfUtils.toWon`, `IsfUtils.toMan`, `IsfUtils.formatMoney`를 적극 활용하여 단위 오차를 방지하십시오.
- **No-build 보존**: 빌드 도구 없이 브라우저에서 즉시 실행 가능한 순수 CSS/JS 형태를 유지하십시오.

## 🧠 지식 관리: LLM Wiki (Compounding Knowledge Engine)
이 프로젝트는 **"LLM Wiki"** 패턴을 따릅니다. 에이전트는 지식을 소모적으로 재발견하지 않고, 끊임없이 풍성해지는 위키 위에서 사고합니다.
- **복리 적립 (Compounding)**: 새로운 지식은 단순히 기록되는 것이 아니라, 기존 노드들과 합성(Synthesize)되어 전체 지식망을 강화해야 합니다.
- **연대기적 감사 (Audit Trail)**: 모든 주요 결정과 지식 수집은 `[[log.md]]`에 기록되어 시간적 맥락을 보존합니다.
- **지식 검증 (Lint)**: 위키 내의 모순을 탐지하고 고아 페이지를 방지하여 지식의 엔트로피를 낮게 유지하십시오.



## 🧭 파트너 스킬 / 역할 기반 라우팅
이 파일은 프로젝트의 모든 규칙을 나열하지 않고, 상황에 맞는 특화 스킬(Skill)과 지식(Knowledge)으로 분기하는 "지도(Map)" 역할을 합니다. 당신의 현재 목적(Phase)에 맞춰서 올바른 문서를 참조하세요.

### 1단계: Context Loading (맥락 로딩)
어떤 작업을 시작하든, 가장 먼저 전체 프로젝트의 메타 지식이 담긴 마스터 인덱스를 읽어서 현재 컨텍스트를 로드하십시오.
- **[필수 참조]** [[.gemini/knowledge/wiki/INDEX.md]] 

### 2단계: Development & Architecture (개발 및 스펙 합의)
사용자로부터 기능 추가, 리팩터링, 아키텍처 제어 등을 지시받았다면, 코드를 작성하기 전에 개발 관점의 지침을 로드해야 합니다.
- **[구현 및 리팩터링]** [[.gemini/agents/isf-developer.md]]
  *(이 안에는 No-build Vanilla JS 원칙, 물리적 무결성(절삭 방지), 단위 정합성 수호 원칙 등이 정의되어 있습니다.)*
- **[에이전트 협업 스킬]** [[.gemini/skills/orchestration/SKILL.md]]
  *(기획(Planner), 구현(Developer), 평가(Evaluator) 간의 핸드오프 순서, 스프린트 계약, 입출력 규격이 정의되어 있습니다.)*

### 3단계: Wiki Indexing & Post-processing (지식 인덱싱 필수 절차)
작업이 끝났다고 그대로 대화를 종료하지 마십시오. 새로운 패턴을 도출했거나 설계를 바꿨다면, 반드시 **에이전트의 영속적 기억**을 갱신하는 절차를 밟아야 합니다.
- **[사서 및 인덱싱 스킬]** [[.gemini/skills/wiki-librarian/SKILL.md]]
  *(이 스킬을 바탕으로, 알아낸 사실을 .gemini/knowledge/wiki/ 에 정리하고, 최종적으로 INDEX.md의 목차 구조(Topology)를 업데이트하세요.)*

---

## 🛠️ 실무 참조 문서 (Reference Manuals)
위의 1~3단계를 따르되, 구체적인 도메인 스펙이 필요할 때만 아래 문서들을 열어보세요. (필요하지 않으면 열지 마세요. 컨텍스트 윈도우는 희소한 자원입니다.)
- 운영 원칙: [[.gemini/knowledge/wiki/Operating_Principles]]
- 아키텍처 참조: [[.gemini/knowledge/wiki/Architecture_Reference.md]]
- 데이터 모델 참조: [[.gemini/knowledge/wiki/Data_Model_Reference.md]]
- UI 및 피드백 표준: [[.gemini/knowledge/wiki/UI_Standards_Reference.md]]
- 브리지 데이터 패턴 (문제 해결 지식): [[.gemini/knowledge/wiki/Data_Bridge_Import_Pattern.md]]
- 기능 백로그 및 TODO: `TODO.md`

(*주의사항: 모든 문서는 한국어(존댓말), UTF-8, 굵게/기울임 표시 지양 규칙을 준수합니다.*)
