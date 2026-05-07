# Individual Savings Flow UI (ISF) - Agent Router

이 리포지토리는 "Individual Savings Flow UI" 어플리케이션을 개발하고 지식을 확장하는 에이전트의 세계입니다. 모든 작업은 아래 라우터와 위키의 지도를 따릅니다.

## 🚨 핵심 가드레일 (Critical Guardrails)
- **무결성 수호**: [[System_Integrity_Standard]] 준수 (절삭 방지, 단위 정합성).
- **행동 강령**: [[Agent_Behavior_Standard]] 준수 (외과적 수정, 주석 최소화).
- **버전 준수**: [[Version_Management_Principles]] 준수 (패치 버전 Bump 필수).

## 📌 필수 작업 프로토콜 (Mandatory Protocols)
1. **Context Load**: 작업 시작 시 [[knowledge/wiki/index.md]]를 읽어 전체 맥락을 파악하십시오.
2. **Version Bump**: 코드 변경이 수반되는 모든 작업 완료 시, `package.json`의 패치 버전을 반드시 +1 하십시오.
3. **Wiki Update**: 새로운 지식이나 패턴이 발견되면 [[wiki-librarian]] 스킬을 사용하여 위키를 갱신하십시오.

## 🧭 역할 기반 라우팅 (Routing)
- **개발/리팩터링**: [[.gemini/agents/isf-developer.md]]
- **기획/검증 협업**: [[.gemini/skills/orchestration/SKILL.md]]
- **지식 관리/인덱싱**: [[.gemini/skills/wiki-librarian/SKILL.md]]

---

## 🛠️ 실무 참조 (Reference Manuals)
- 운영 원칙: [[Operating_Principles]]
- 아키텍처: [[Architecture_Reference]]
- 데이터 모델: [[Data_Model_Reference]]
- 기능 백로그: `TODO.md`

(*모든 문서는 한국어(존댓말), UTF-8을 준수합니다.*)
