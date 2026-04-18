# Key Features

This reference captures the main repository capabilities and points each one back to the files that implement or document it.

[AGENTS](../../AGENTS.md) · [Overview](../../AGENTS.md#key-features) · [Architecture](SYSTEM_ARCHITECTURE.md) · [Getting Started](GETTING_STARTED.md)

## On this page

- [Core Features](#core-features)
- [Operational Features](#operational-features)
- [Integrations](#integrations)

## Core Features

| Feature                                                      | Repository anchors                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Auto-pipeline evaluation for a pasted JD or job URL          | `modes/auto-pipeline.md`, `modes/oferta.md`, `../ARCHITECTURE.md`                         |
| Structured offer evaluation and report generation            | `modes/_shared.md`, `modes/oferta.md`, `../ARCHITECTURE.md`                               |
| ATS-oriented PDF generation                                  | `generate-pdf.mjs`, `templates/cv-template.html`, `../../fonts/`                          |
| Portal scanning from configured companies and search queries | `scan.mjs`, `../../templates/portals.example.yml`, `../SCRIPTS.md`                        |
| Tracker maintenance and integrity checks                     | `merge-tracker.mjs`, `verify-pipeline.mjs`, `normalize-statuses.mjs`, `dedup-tracker.mjs` |
| Application dashboard in the terminal                        | `../../dashboard/main.go`, `../ARCHITECTURE.md`                                           |

## Operational Features

- Batch processing runs parallel `claude -p` workers through `../../batch/batch-runner.sh` and documents the workflow in `../../batch/README.md`.
- The repository includes specialized modes for `deep`, `training`, `project`, `interview-prep`, `patterns`, and `followup` workflows inside `../../modes/`.
- The scanner and liveness tooling rely on Playwright and the checked-in portal configuration rather than a parallel automation layer.
- OpenCode command entrypoints in `../../.opencode/commands/` mirror the main Career-Ops flows.
- Language-specific mode directories exist for German, French, Japanese, Portuguese, and Russian in `../../modes/`.

## Integrations

- PDF generation and reliable job verification depend on Playwright Chromium, which the setup docs require you to install.
- The portal template documents a three-layer discovery strategy: direct career pages with Playwright, structured Greenhouse API access, and broader WebSearch queries.
- The root scripts are exposed through `npm run ...` commands in `../../package.json`, so agents should reuse the checked-in script entrypoints.
- Human review remains mandatory: `../../CLAUDE.md`, `../CODEX.md`, and `../../CONTRIBUTING.md` all reinforce that the system should not auto-submit applications.

## Related

- [AGENTS](../../AGENTS.md)
- [Overview](../../AGENTS.md#key-features)
- [Architecture](SYSTEM_ARCHITECTURE.md)
- [Getting Started](GETTING_STARTED.md)
