## What changed

### 1. Excel import keeps existing records
- `apps/api/src/tqc/tqc.service.ts`: `createMany` no longer calls `deleteByModule` before inserting. Imported rows are added to the existing data.
- Rows that exactly match an existing record (all data columns, date compared as `YYYY-MM-DD`) or that repeat within the same file are skipped, so importing the same file again doesn't create duplicates.
- The upload endpoint now returns `{ count, skipped }`, and the import alert shows how many records were added and how many duplicates were skipped.

### 2. USP Classification can be edited per row
- New endpoint `PATCH /api/tqc/:id/usp` with body `{ uspClassification }`. It updates one row through raw SQL, matching how the rest of the service handles `usp_classification`. An empty value saves as `NULL`, and an unknown id returns 404.
- `apps/web/src/app/admin/tqc/[module]/page.tsx`: the USP Classification column is now a text input. It saves on Enter or blur, Esc reverts, and nothing is sent if the value didn't change. Local state is updated without refetching the table.

## Why
- Importing a new TQC Excel file wiped every record already in the system for that module.
- USP Classification could only be set through the Excel import. Users need to add or fix it for each defect row directly in the table.

## Notes for reviewers
- Both changes apply to every TQC module that uses this page. The Sewing layout has no USP column, so it's unchanged.
- A row edited in Excel (e.g. a different Qty Defect) is imported as a new record. It does not update the old one.
- USP edits apply to one row only. Other rows with the same defect are not changed.
- **Clear All** still removes all records for a module manually.
- Type-check passes for `apps/api` and `apps/web`. Not yet tested manually against a running app or DB.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
