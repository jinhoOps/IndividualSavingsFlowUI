# Individual Savings Flow UI (ISF) - Main Agent Router

이 리포지토리는 "Individual Savings Flow UI" 어플리케이션을 개발하고 지식을 확장하는 에이전트의 세계입니다. 모든 에이전트 작업은 ఈ 라우터(Router)의 지휘를 받습니다.

## 🧭 파트너 스킬 / 역할 기반 라우팅
이 파일은 프로젝트의 모든 규칙을 나열하지 않고, 상황에 맞는 특화 스킬(Skill)과 지식(Knowledge)으로 분기하는 "지도(Map)" 역할을 합니다. 당신의 현재 목적(Phase)에 맞춰서 올바른 문서를 참조하세요.

### 1단계: Context Loading (맥락 로딩)
어떤 작업을 시작하든, 가장 먼저 전체 프로젝트의 메타 지식이 담긴 마스터 인덱스를 읽어서 현재 컨텍스트를 로드하십시오.
- **[필수 참조]** [[.gemini/knowledge/wiki/INDEX.md]] 

### 2단계: Development & Architecture (개발 및 스펙 합의)
사용자로부터 기능 추가, 리팩토링, 아키텍처 제어 등을 지시받았다면, 코드를 작성하기 전에 개발 관점의 스킬을 먼저 로드해야 합니다.
- **[개발 특화 스킬]** [[.gemini/skills/core-developer/SKILL.md]]
  *(이 안에는 No-build Vanilla JS 원칙, 컴포넌트 재사용 원칙, Generator-Evaluator 패턴 기반의 "스프린트 계약" 맺는 법 등이 정의되어 있습니다.)*

### 3단계: Wiki Indexing & Post-processing (지식 인덱싱 필수 절차)
작업이 끝났다고 그대로 대화를 종료하지 마십시오. 새로운 패턴을 도출했거나 설계를 바꿨다면, 반드시 **에이전트의 영속적 기억**을 갱신하는 절차를 밟아야 합니다.
- **[사서 및 인덱싱 스킬]** [[.gemini/skills/wiki-librarian/SKILL.md]]
  *(이 스킬을 바탕으로, 알아낸 사실을 .gemini/knowledge/wiki/ 에 정리하고, 최종적으로 INDEX.md의 목차 구조(Topology)를 업데이트하세요.)*

---

## 🛠️ 실무 참조 문서 (Reference Manuals)
위의 1~3단계를 따르되, 구체적인 도메인 스펙이 필요할 때만 아래 문서들을 열어보세요. (필요하지 않으면 열지 마세요. 컨텍스트 윈도우는 희소한 자원입니다.)
- 운영 원칙: [[.gemini/knowledge/wiki/Operating_Principles]]
- UI 및 피드백 표준: `references/ui-standards.md`
- 브리지 데이터 패턴 (문제 해결 지식): [[.gemini/knowledge/wiki/Data_Bridge_Import_Pattern.md]]
- 기능 백로그 및 TODO: `TODO.md`

(*주의사항: 모든 문서는 한국어(존댓말), UTF-8, 굵게/기울임 표시 지양 규칙을 준수합니다.*)
