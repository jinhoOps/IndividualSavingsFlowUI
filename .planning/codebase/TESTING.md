# Testing Strategy

## Quality Pillars
1. **Visual Integrity**: UI/UX must not break across common mobile resolutions (760px and below).
2. **Logic Accuracy**: Financial calculations must match the "가계 추이 계산 검증" table logic.
3. **Data Persistence**: State must persist correctly across reloads and inter-step navigation.

## Verification Procedures
- **Manual UAT**: Core flow validation (Input → Apply → View Sankey).
- **Regression Check**: Verify large file edits haven't truncated media queries or utility classes.
- **Unit Logic Audit**: Periodic check of `calculator.js` against known test samples.

## Current Limitations
- No automated unit testing framework (e.g., Vitest/Jest) is integrated to maintain the "No-Build" simplicity.
- Verification relies on agent-led manual audits and user feedback.
