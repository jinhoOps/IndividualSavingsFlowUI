# Individual Savings Flow UI (ISF) - Main Agent Router

이 리포지토리는 "Individual Savings Flow UI" 어플리케이션을 개발하고 지식을 확장하는 에이전트의 세계입니다. 모든 에이전트 작업은 라우터(Router)의 지휘를 받습니다.

## 🚨 핵심 원칙: 시스템 무결성 (System Integrity)
**이 프로젝트에서 UI/UX와 데이터 무결성은 기능만큼 중요합니다.** 에이전트는 아래 사항을 절대적으로 준수해야 합니다.
- **스타일 및 반응형 무결성**: 
    - **물리적 무결성**: CSS/HTML 수정 시 파일 하단의 `@media` 쿼리나 유틸리티 클래스가 절삭(Truncate)되지 않도록 수정 전후의 파일 크기와 구조를 반드시 대조하십시오.
    - **반응형 우선**: 760px 이하 모바일 레이아웃이 파손되지 않았는지 Evaluator 단계에서 시각적으로 재검증해야 합니다.
    - **명명 규칙 (BEM/Snake)**: CSS 클래스는 BEM 표기법(`block__element--modifier`) 또는 단어 간 하이픈/언더스코어를 사용하는 스네이크 스타일을 일관되게 적용하여 스타일 통일성을 유지하십시오.
- **로직 보존 (Core Logic Protection)**: 
    - 리팩토링 시 `app.js`의 **3계층 구조(상태/헬퍼/UI)**를 유지하고, `markDirty` 등 14종 이상의 필수 헬퍼 함수가 소실되지 않도록 주의하십시오.
- **단위 정합성 (Unit consistency)**: 
    - 모든 사용자 입력, UI 표시, 내부 계산 및 데이터 저장(IndexedDB, Bridge)은 **'원'** 단위로 완전히 통일합니다. 사용자의 입력 편의성을 위해 실시간 한글 금액 변환 힌트를 UI에 제공합니다.

    - 모든 내부 계산 및 영속화 데이터는 **원** 단위를 유지하십시오.
    - **억원 단위 표기**: 1억 원(10,000 만원) 이상일 경우 `X 억 Y 만원` 형태로 표기하여 가독성을 높이십시오.
    - **금융종합소득과세 경고**: 연간 이자/배당 소득이 **1,900만 원** 초과 시 `warn`, **3,400만 원** 초과 시 `crit` 경고를 UI에 표시하십시오.
    - 변환 시 `IsfUtils.toWon`, `IsfUtils.toMan`, `IsfUtils.formatMoney`를 적극 활용하여 단위 오차를 방지하십시오.
- **No-build 지향 (Modern Hybrid)**: 순수 CSS/JS의 간결함을 지향하되, 대규모 리팩터링 및 타입 안정성을 위해 Vite/TS/Tailwind 인프라를 수용합니다. 또한, 향후 복잡한 UI 대시보드 및 상태 관리를 위해 **React**를 점진적으로 도입할 계획이며, 이를 위한 기본 의존성을 확보하고 있습니다. 단, 레거시 모듈의 즉각적인 브라우저 실행 가용성을 최대한 존중하십시오.

## 🛠️ 행동 강령: 에이전트 행동 지침 (Behavioral Guardrails)
에이전트는 코드 수정 시 속도보다 **안전**과 **최소 개입**을 우선시합니다.

- **코딩 전 사고 (Think First)**: 추측하지 마십시오. 모호한 점이 있다면 구현 전에 질문하고, 가능한 대안 중 가장 단순한 길을 제시하십시오.
- **단순성 최우선 (Simplicity First)**: 요청받지 않은 기능을 추가하지 마십시오. 단 한 번만 쓰일 코드에 추상화를 도입하지 마십시오. "시니어 엔지니어가 보기에 지나치게 복잡한가?"라고 스스로 질문하십시오.
- **외과적 수정 (Surgical Changes)**: 요청과 직접 관련 없는 인접 코드를 '개선'하려 하지 마십시오. 기존 스타일을 존중하고, 수정으로 인해 더 이상 사용되지 않게 된 변수/임포트만 정리하십시오.
- **목표 중심 실행 (Goal-Driven)**: "작동하게 하라"는 모호한 목표 대신, "검증 가능한 성공 기준"을 세우고 테스트를 통해 증명하십시오. 멀티스텝 작업 시 아래 형식으로 계획을 명시하십시오:
    ```
    1. [Step] → verify: [check]
    2. [Step] → verify: [check]
    ```
- **사람을 위한 주석 지양 (No Human-Targeted Comments)**: 에이전트가 코드를 직접 다루므로, JS 코드 내에 사람을 위한 설명형 주석을 추가하지 마십시오. 코드는 그 자체로 의도를 드러내야 하며 불필요한 주석은 컨텍스트를 낭비합니다.

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
  *(이 안에는 No-build 지향 (Modern Hybrid) 원칙, 물리적 무결성(절삭 방지), 단위 정합성 수호 원칙 등이 정의되어 있습니다.)*
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
