# Product Experience Review Skill Design

## Goal

Create one repository-local skill that helps an agent understand the current project and give evidence-based feedback across product planning, visual design, frontend implementation, and end-to-end user experience.

The default output is a concise conversational briefing. A persistent Markdown report is optional, not the normal result.

## Location

Create:

`/.agents/skills/review-product-experience/SKILL.md`

Do not install a global skill or create a plugin. Keep the workflow specific to this repository and its canonical documents.

## Trigger

Use the skill when the user asks to:

- assess current development progress;
- review the product from planner, designer, frontend, or UX perspectives;
- identify what is complete, misleading, inconsistent, or risky;
- recommend the next product or experience priorities;
- perform a cross-functional product audit.

Do not trigger it for a narrow code diff review, a single known bug, or direct implementation work with already-approved requirements.

## Evidence Sources

Read the smallest relevant set in this order:

1. `AGENTS.md`
2. Product PRD
3. `.planning/STATE.md`
4. `.planning/ROADMAP.md`
5. `.planning/REQUIREMENTS.md`
6. `DESIGN.md`
7. `README.md`
8. recent commits and current `git status`
9. affected code and tests
10. live or local browser UI when making visual or UX claims

Historical milestone and legacy files are evidence only when a current claim depends on them. They must not override current product-state documents.

## Review Lenses

### Product Planning

- user problem and value;
- current, migration, and future scope;
- roadmap priority and dependency order;
- completion metrics and misleading progress claims;
- acceptance criteria and unresolved decisions.

### Design

- information hierarchy and summary-first behavior;
- consistency with DESIGN;
- responsive behavior at 390px, 768px, and desktop;
- accessibility, content hierarchy, and visual feedback;
- distinction between current functionality and readiness states.

### Frontend

- implemented routes and actual state ownership;
- loading, empty, error, recovery, draft, and saved states;
- compatibility and legacy isolation;
- observable test coverage;
- mismatches between UI claims, documentation, and runtime behavior.

### UX

- first-use comprehension;
- primary task discoverability;
- decision flow and cognitive load;
- feedback after user actions;
- cross-destination continuity;
- mobile usability and recovery from failure.

## Workflow

1. Confirm the requested scope and whether browser inspection is needed.
2. Establish the current product baseline from canonical documents.
3. Compare roadmap/status claims against recent implementation evidence.
4. Inspect code and tests only where needed to verify a claim.
5. Inspect the actual UI before making visual or interaction-quality claims.
6. Separate observations into:
   - confirmed strengths;
   - actionable gaps;
   - decisions needed;
   - recommended next actions.
7. Lead with the most consequential finding, not a document summary.
8. Report evidence, user impact, and recommendation for each material gap.

Do not convert roadmap percentage directly into product completion percentage. Explain what the metric includes.

## Default Output

Reply in conversation with:

1. current product state;
2. top findings ordered by user and product impact;
3. planning feedback;
4. design and UX feedback;
5. frontend evidence and risks;
6. recommended next decision or action.

Keep it concise enough to act on. Do not create a report file merely because the review is substantial.

## Optional Report

Create `docs/reviews/YYYY-MM-DD-product-experience-review.md` only when:

- the user asks for a report;
- the result will be handed to another person or agent;
- findings need longitudinal tracking;
- the review establishes a release or milestone gate.

The report uses the same evidence and sections as the conversational response and records the reviewed commit or branch.

## Minor Change Authority

The review is read-only by default. After presenting a finding, the agent may apply a minor change only when the user explicitly approves that change.

Allowed after approval:

- documentation status, links, terminology, and small consistency fixes;
- user-facing copy corrections;
- narrowly scoped accessibility labels or semantic attributes;
- small CSS presentation fixes with no data, navigation, or state ownership impact;
- focused test expectation updates that only align with an already-approved current contract.

Always separate into another implementation task:

- new features or new routes;
- data model, calculation, persistence, compatibility, or migration behavior;
- architectural refactoring;
- deletion of legacy assets;
- broad visual redesign;
- deployment, release, remote deletion, or other external mutation.

Before an approved minor edit, name the exact files and verification. Preserve unrelated changes and follow the repository verification matrix.

## Safety and Quality Rules

- Distinguish fact, inference, and recommendation.
- Cite repository paths or browser evidence for material claims.
- Do not judge visual quality from source code alone.
- Do not treat historical implementation as current shipped functionality.
- Do not duplicate the PRD or Roadmap in the response.
- Do not inflate the review with style preferences that lack user impact.
- Do not modify files while still gathering review evidence.
- If canonical sources conflict, follow the priority in `AGENTS.md` and report the conflict.

## Acceptance Criteria

- The skill is repository-local and consists of a concise `SKILL.md`.
- Its description reliably triggers on progress, product, design, frontend, and UX review requests.
- It uses canonical product status before historical evidence.
- It requires browser evidence for visual and interaction-quality claims.
- It responds conversationally by default.
- It writes a report only under explicit or durable-tracking conditions.
- It cannot silently implement findings.
- Approved minor-change boundaries are concrete.
- Major or external changes remain separate tasks.
