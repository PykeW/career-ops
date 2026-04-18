# Project Structure

This reference expands the root `AGENTS.md` summary with the repository layout, the directories that matter most to agents, and the files that anchor the main workflows.

[AGENTS](../../AGENTS.md) · [Overview](../../AGENTS.md#project-structure) · [Architecture](SYSTEM_ARCHITECTURE.md) · [Development](DEVELOPMENT_WORKFLOW.md)

## On this page

- [Repository Layout](#repository-layout)
- [Major Directories](#major-directories)
- [Key Entrypoints](#key-entrypoints)

## Repository Layout

```text
career-ops/
├── AGENTS.md
├── CLAUDE.md
├── DATA_CONTRACT.md
├── README.md
├── CONTRIBUTING.md
├── package.json
├── .claude/skills/
├── .opencode/commands/
├── backend/
├── frontend/
├── shared/
├── web/
├── batch/
├── config/
├── dashboard/
├── docs/
│   └── agents/
├── examples/
├── fonts/
├── interview-prep/
├── jds/
├── modes/
├── templates/
├── data/
├── reports/
├── output/
└── *.mjs
```

## Major Directories

| Path                  | Purpose                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `backend/`            | Contains the dedicated local API service used by the split app runtime.                     |
| `frontend/`           | Contains the Vite + React UI, including `frontend/src/App.tsx` as the main entrypoint.      |
| `shared/`             | Holds the shared frontend/backend contract helpers and cross-runtime types.                 |
| `web/`                | Keeps the deprecated forwarding shim for the pre-split backend entrypoint.                  |
| `config/`             | Holds checked-in configuration templates such as `profile.example.yml`.                     |
| `modes/`              | Contains the shared workflow instructions plus language-specific mode directories.          |
| `batch/`              | Stores the batch prompt, runner script, worker logs, and tracker additions.                 |
| `dashboard/`          | Contains the optional Go terminal dashboard application.                                    |
| `templates/`          | Provides the CV HTML template, scanner example config, and canonical tracker states.        |
| `docs/`               | Holds setup, architecture, scripting, customization, and agent-facing references.           |
| `data/`               | Stores user-owned tracker and pipeline files under the data contract.                       |
| `reports/`            | Stores generated evaluation reports.                                                        |
| `output/`             | Stores generated PDFs and related outputs.                                                  |
| `interview-prep/`     | Stores story-bank material and company-specific interview notes.                            |
| `jds/`                | Stores saved job descriptions.                                                              |
| `examples/`           | Provides sample files that demonstrate expected formats without affecting runtime behavior. |
| `.opencode/commands/` | Mirrors the main workflows as OpenCode command entrypoints.                                 |
| `fonts/`              | Stores the self-hosted fonts used by PDF generation.                                        |

## Key Entrypoints

| File or path                       | Why it matters                                                       |
| ---------------------------------- | -------------------------------------------------------------------- |
| `AGENTS.md`                        | Codex-facing entry document and navigation hub.                      |
| `CLAUDE.md`                        | Canonical agent workflow instructions and onboarding behavior.       |
| `DATA_CONTRACT.md`                 | Source of truth for user-layer versus system-layer boundaries.       |
| `docs/CODEX.md`                    | Explains how Codex should route into the existing modes and scripts. |
| `frontend/src/App.tsx`             | Main UI entrypoint for the split frontend experience.                |
| `shared/contracts/api-contract.ts` | Canonical frontend/backend contract helpers and types.               |
| `backend/server.mjs`               | Dedicated API server entrypoint used by the split app.               |
| `web/server.mjs`                   | Deprecated shim that forwards to `backend/server.mjs`.               |
| `config/profile.example.yml`       | Template for the user's `config/profile.yml`.                        |
| `modes/_profile.template.md`       | Template for the user's personal override file.                      |
| `templates/portals.example.yml`    | Starter scanner configuration that becomes `portals.yml`.            |
| `scan.mjs`                         | Portal scanner entrypoint exposed as `npm run scan`.                 |
| `generate-pdf.mjs`                 | HTML-to-PDF renderer exposed as `npm run pdf`.                       |
| `merge-tracker.mjs`                | Merges batch tracker additions into `data/applications.md`.          |
| `verify-pipeline.mjs`              | Validates tracker integrity and report links.                        |
| `batch/batch-runner.sh`            | Orchestrates batch evaluation with `claude -p` workers.              |
| `dashboard/main.go`                | Main entrypoint for the Go dashboard application.                    |
| `.opencode/commands/career-ops.md` | Default OpenCode entrypoint for the checked-in command set.          |

For canonical workflow boundaries, also review [DATA_CONTRACT.md](../../DATA_CONTRACT.md), [CLAUDE.md](../../CLAUDE.md), and [docs/CODEX.md](../CODEX.md).

## Related

- [AGENTS](../../AGENTS.md)
- [Overview](../../AGENTS.md#project-structure)
- [Architecture](SYSTEM_ARCHITECTURE.md)
- [Development](DEVELOPMENT_WORKFLOW.md)
