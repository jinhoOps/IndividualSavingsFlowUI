# Current Concerns

## Legacy Surface Is Large

Detailed old apps and shared modules remain beside the supported React product. File presence can be mistaken for product support.

Mitigation:

- route agents through PRD, State, Requirements, and current tests
- prohibit new runtime dependencies on retained apps
- inventory and remove one approved destination at a time

## Compatibility Is More Complex Than the Current Model

The current Main model is small, but repository startup considers local state, IndexedDB, pending writes, recovery data, and older payloads.

Mitigation:

- keep compatibility logic behind `mainRepository.ts`
- preserve fixtures and conflict-resolution tests
- never simplify storage based only on the visible five fields

## Build Has Version Side Effects

`npm run build` invokes version bump and synchronization scripts before Vite.

Mitigation:

- use `npm run check` for ordinary static verification
- inspect the working tree before and after build
- do not commit unrelated version churn with a focused change

## Documentation Can Drift Toward Future Vision

ISF’s concept includes long-term simulation, portfolios, and account relationships, while the supported product currently stops at readiness.

Mitigation:

- label current, transition, and future statements
- require runtime/test evidence for completion claims
- update PRD, README, DESIGN, State, Roadmap, and Requirements when a product boundary changes

## Financial Trust

Even simple cashflow results can influence real decisions.

Mitigation:

- expose inputs and deficit states clearly
- avoid presenting estimates as advice
- keep future assumptions and limitations near their results
