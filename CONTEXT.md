# IndividualSavings Flow UIUX

This context defines the user-facing financial planning language used by the app. It keeps UX discussions aligned around what users are viewing versus what they are editing.

## Language

**Summary Surface**:
The default Step 1 surface where users confirm financial information, scan totals, and open deeper flows. It is not the place for ordinary financial item editing.
_Avoid_: Main editor, default editor, dashboard editor

**Financial Detail Modal**:
The primary editing surface for Step 1 financial settings. Users should be able to complete income, expense, savings, investment, and account edits here without relying on another financial editor.
_Avoid_: Category modal, new modal, advanced editor

**Auxiliary Advanced Editor**:
A secondary or legacy financial editing surface that may remain for compatibility or narrow fallback cases. It should not be treated as the normal user path.
_Avoid_: Main editor, primary editor

**Income Account Allocation**:
The split of one income item across one or more destination accounts. The read row should show only the representative deposit account, while allocation editing belongs inside the income row edit state in the Financial Detail Modal.
_Avoid_: Manual transfer, separate transfer rule

**Savings Maturity Month**:
The month when a savings item stops receiving new contributions in the simulation. After this month, the savings item should no longer receive new monthly contributions, while the accumulated balance remains in projection calculations; investment items do not use maturity month.
_Avoid_: Display-only maturity, memo date

**Item-Level Savings Yield**:
The annual yield attached to one savings item instead of the global default yield. It belongs with maturity month inside a collapsed additional settings area of the savings row edit state.
_Avoid_: Global savings yield, display rate
