# Development

This reference keeps the day-to-day commands and validation flow close to `AGENTS.md` without replacing the canonical script and contribution docs.

[AGENTS](../../AGENTS.md) · [Overview](../../AGENTS.md#development) · [Getting Started](GETTING_STARTED.md) · [Configuration](CONFIGURATION.md)

## On this page

- [Common Commands](#common-commands)
- [Local Workflow](#local-workflow)
- [Testing and Validation](#testing-and-validation)

## Common Commands

| Command                | Purpose                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run doctor`       | Validate prerequisites and required local files.                      |
| `npm run verify`       | Check tracker integrity, report links, and pending tracker additions. |
| `npm run normalize`    | Map tracker statuses to canonical values.                             |
| `npm run dedup`        | Remove duplicate tracker entries.                                     |
| `npm run merge`        | Merge batch TSV additions into `data/applications.md`.                |
| `npm run pdf`          | Render an HTML CV into a PDF.                                         |
| `npm run sync-check`   | Check CV/profile consistency and shared prompt safety.                |
| `npm run update:check` | Check for upstream system-layer updates.                              |
| `npm run update`       | Apply an upstream system-layer update.                                |
| `npm run rollback`     | Restore the previous system-layer backup created during update.       |
| `npm run liveness`     | Check whether saved job URLs still look active.                       |
| `npm run scan`         | Run the zero-token portal scanner.                                    |

## Local Workflow

1. Start with `../../AGENTS.md`, `../../CLAUDE.md`, and `../../DATA_CONTRACT.md` so you know where changes belong.
2. Keep user-specific edits in `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, `portals.yml`, or other user-layer paths listed in `../../DATA_CONTRACT.md`.
3. Reuse the checked-in scripts, modes, and templates instead of introducing duplicate entrypoints or parallel automation.
4. If you change batch behavior, review `../../batch/README.md` and `../../batch/batch-prompt.md` together.
5. If you change dashboard code, build `../../dashboard/` before you consider the work done.
6. Follow `../../CONTRIBUTING.md` for issue-first contributions, data-handling rules, and prohibited automation.

## Testing and Validation

- Use `npm run doctor` after setup or dependency changes.
- Use `npm run verify` after tracker, report, or merge-flow changes.
- Use `npm run sync-check` after editing shared prompts, profile expectations, or personalization boundaries.
- Use `npm run merge -- --verify` when validating batch tracker additions end to end.
- Use `npm run normalize -- --dry-run` or `npm run dedup -- --dry-run` before applying tracker maintenance changes.
- Use `cd dashboard && go build -o career-dashboard .` for dashboard validation.

For script-by-script details, see [docs/SCRIPTS.md](../SCRIPTS.md). For contribution expectations, see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Related

- [AGENTS](../../AGENTS.md)
- [Overview](../../AGENTS.md#development)
- [Getting Started](GETTING_STARTED.md)
- [Configuration](CONFIGURATION.md)
