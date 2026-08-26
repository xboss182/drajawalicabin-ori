# Restore three files to the identical-tree state

Bring the workspace back to the exact tree of commit `1fa1479` (identical to restore commit `5ce3573`, tree `da69846...`) by restoring only the three files that currently differ.

## Files to restore

- `.lovable/mcp/manifest.json`
- `bun.lock`
- `src/integrations/supabase/types.ts`

Verified: these are the only three files differing from `1fa1479`, and the working tree is otherwise clean. So restoring exactly these three reproduces tree `da6984610985853f8757f4dca22193dc49af8b3c`.

## How

For each of the three paths, write the file content taken from the target commit (`git show 1fa1479:<path>`) over the current file. No other file is touched. No migrations, policies, data, secrets, settings, or WhatsApp/WAHA changes. No publish.

Commit creation is handled by the platform, so the resulting workspace commit will contain only these three restorations.

## Verification (read-only, after the change)

Report:
1. full current HEAD SHA
2. current tree SHA
3. whether the working tree is clean
4. file-name-only diff against `1fa1479` (expected: empty)
5. whether the tree SHA equals `da6984610985853f8757f4dca22193dc49af8b3c`

## Stop condition

If restoring these three paths would alter any other file, or the resulting tree SHA is not `da69846...`, stop without publishing and explain the discrepancy. Note that a dependency install or a schema-types regeneration triggered by tooling could re-modify `bun.lock` or `types.ts`; neither will be run as part of this change.
