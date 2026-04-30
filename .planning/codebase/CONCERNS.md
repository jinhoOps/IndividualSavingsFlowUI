# Codebase Concerns

## Critical Invariants
- **Unit Consistency**: Mixing Won and Man-won in calculations can lead to catastrophic financial projection errors. Must use `IsfUtils` for all conversions.
- **Physical Integrity**: Risk of file truncation during AI edits, especially in large files like `app.js` or `styles.css`. Media queries at the bottom are particularly vulnerable.

## Technical Debt
- **Direct DOM Binding**: `dom.js` and `app.js` have tight coupling with specific HTML IDs. Refactoring UI structure requires careful update of these bindings.
- **Large Files**: `app.js` (34KB) and `styles.css` (22KB) are growing large. Future modularization of the main entry point might be needed.

## Performance
- **Sankey Calculation**: Large datasets or frequent updates might impact main thread performance during SVG generation.
- **IndexedDB**: Periodic automated backups (12h interval) should be monitored for storage bloat.

## Security
- **Data Privacy**: All data is local-first. Sharing relies on URL hashes or IndexedDB. No server-side persistence currently implemented for sensitive financial data.
- **Input Sanitization**: Must ensure `input-sanitizer.js` covers all edge cases to prevent XSS via shared link names.
