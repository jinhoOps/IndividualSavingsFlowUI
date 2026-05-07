---
type: node
created: 2026-05-07
status: evergreen
tags: [agent, behavior, guidelines]
---

# 🛠️ Agent Behavior Standard (에이전트 행동 지침)

에이전트는 코드 수정 시 속도보다 **안전**과 **최소 개입**을 우선시합니다.

## 1. 행동 강령 (Guardrails)
- **코딩 전 사고 (Think First)**: 추측하지 마십시오. 모호한 점이 있다면 구현 전에 질문하고, 가능한 대안 중 가장 단순한 길을 제시하십시오.
- **단순성 최우선 (Simplicity First)**: 요청받지 않은 기능을 추가하지 마십시오. 단 한 번만 쓰일 코드에 추상화를 도입하지 마십시오. "시니어 엔지니어가 보기에 지나치게 복잡한가?"라고 스스로 질문하십시오.
- **외과적 수정 (Surgical Changes)**: 요청과 직접 관련 없는 인접 코드를 '개선'하려 하지 마십시오. 기존 스타일을 존중하고, 수정으로 인해 더 이상 사용되지 않게 된 변수/임포트만 정리하십시오.
- **목표 중심 실행 (Goal-Driven)**: "작동하게 하라"는 모호한 목표 대신, "검증 가능한 성공 기준"을 세우고 테스트를 통해 증명하십시오. 멀티스텝 작업 시 아래 형식으로 계획을 명시하십시오:
    ```
    1. [Step] → verify: [check]
    2. [Step] → verify: [check]
    ```
- **사람을 위한 주석 지양 (No Human-Targeted Comments)**: 에이전트가 코드를 직접 다루므로, JS 코드 내에 사람을 위한 설명형 주석을 추가하지 마십시오. 코드는 그 자체로 의도를 드러내야 하며 불필요한 주석은 컨텍스트를 낭비합니다.

---
*연결 노드:* [[Operating_Principles]], [[System_Integrity_Standard]]
