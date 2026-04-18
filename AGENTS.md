# Career-Ops

## Overview

### Purpose
Career-Ops is an AI-powered job-search pipeline built around the checked-in modes, Node.js scripts, Playwright tooling, and an optional Go dashboard. The repository evaluates job descriptions or URLs, generates ATS-oriented PDFs, scans portals, batch-processes offers, and tracks applications with markdown and TSV files.

For Codex, use this file as the entry point, then route into [`CLAUDE.md`](CLAUDE.md), [`DATA_CONTRACT.md`](DATA_CONTRACT.md), and [`docs/CODEX.md`](docs/CODEX.md). Reuse the existing modes, scripts, templates, and tracker flow rather than creating a parallel automation layer. Keep user-specific customization in `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, and `portals.yml`, and never submit an application on the user's behalf.

### Documentation Map
- Core agent docs: [`CLAUDE.md`](CLAUDE.md), [`DATA_CONTRACT.md`](DATA_CONTRACT.md), [`docs/CODEX.md`](docs/CODEX.md)
- Detailed references for this entrypoint:
  - [`docs/agents/PROJECT_STRUCTURE.md`](docs/agents/PROJECT_STRUCTURE.md)
  - [`docs/agents/KEY_FEATURES.md`](docs/agents/KEY_FEATURES.md)
  - [`docs/agents/GETTING_STARTED.md`](docs/agents/GETTING_STARTED.md)
  - [`docs/agents/DEVELOPMENT_WORKFLOW.md`](docs/agents/DEVELOPMENT_WORKFLOW.md)
  - [`docs/agents/CONFIGURATION.md`](docs/agents/CONFIGURATION.md)
  - [`docs/agents/SYSTEM_ARCHITECTURE.md`](docs/agents/SYSTEM_ARCHITECTURE.md)
- Canonical repo docs: [`docs/SETUP.md`](docs/SETUP.md), [`docs/SCRIPTS.md`](docs/SCRIPTS.md), [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Technology Stack

### Core Stack
- Node.js 18+ runs the root automation scripts exposed in `package.json`.
- JavaScript ES modules (`*.mjs`) handle scanning, verification, PDF generation, tracker maintenance, update checks, liveness checks, and related utilities.
- Playwright provides browser automation for PDF generation and job verification.
- `js-yaml` backs YAML-driven configuration such as `config/profile.yml` and `portals.yml`.
- The dashboard in `dashboard/` uses Go, with `dashboard/go.mod` currently declaring `go 1.24.2`.

### Tooling and Infrastructure
- Bubble Tea, Lip Gloss, and related Go dependencies power the terminal dashboard.
- Markdown, YAML, HTML, TSV, and plain-text files are the main documentation, configuration, and data formats.
- `.opencode/commands/` mirrors the main workflows as checked-in OpenCode command entrypoints.
- `.envrc` and `flake.nix` provide optional direnv/Nix support.
- `fonts/` stores the self-hosted fonts used by PDF generation.

## Project Structure

### Repository Summary
The repository is centered on agent instructions (`AGENTS.md`, `CLAUDE.md`), workflow modes in `modes/`, root automation scripts, user-owned data in `data/`, generated artifacts in `reports/` and `output/`, and supporting docs in `docs/`.

### Reference
See [`docs/agents/PROJECT_STRUCTURE.md`](docs/agents/PROJECT_STRUCTURE.md) for the full repository layout, major directories, and key entrypoints.

## Key Features

### Capability Summary
Career-Ops supports auto-pipeline evaluation, structured offer scoring, ATS-oriented PDF generation, portal scanning, batch processing with `claude -p` workers, tracker integrity tooling, specialized interview and research modes, and an optional dashboard for browsing and updating application status.

### Reference
See [`docs/agents/KEY_FEATURES.md`](docs/agents/KEY_FEATURES.md) for the feature breakdown and file-level anchors.

## Getting Started

### Quick Start
1. Install dependencies:
   ```bash
   npm install
   npx playwright install chromium
   ```
2. Create the user-layer configuration files from the checked-in templates:
   ```bash
   cp config/profile.example.yml config/profile.yml
   cp modes/_profile.template.md modes/_profile.md
   cp templates/portals.example.yml portals.yml
   ```
3. Add `cv.md` in the repository root, and add `article-digest.md` if you want extra proof points.
4. Validate the setup:
   ```bash
   npm run doctor
   npm run verify
   npm run sync-check
   ```
5. Start from your preferred client in this repository:
   - Claude Code is documented in [`README.md`](README.md) and [`docs/SETUP.md`](docs/SETUP.md).
   - Codex is documented in [`docs/CODEX.md`](docs/CODEX.md).

### Reference
See [`docs/agents/GETTING_STARTED.md`](docs/agents/GETTING_STARTED.md) for the condensed startup flow, [`docs/SETUP.md`](docs/SETUP.md) for the fuller setup guide, and [`docs/CODEX.md`](docs/CODEX.md) for Codex-specific routing.

## Development

### Common Commands
- `npm run doctor`
- `npm run verify`
- `npm run normalize`
- `npm run dedup`
- `npm run merge`
- `npm run pdf`
- `npm run sync-check`
- `npm run update:check`
- `npm run update`
- `npm run rollback`
- `npm run liveness`
- `npm run scan`

If you change the dashboard, build it from `dashboard/` with `go build -o career-dashboard .`.

### Reference
See [`docs/agents/DEVELOPMENT_WORKFLOW.md`](docs/agents/DEVELOPMENT_WORKFLOW.md) for the agent-oriented workflow summary and [`docs/SCRIPTS.md`](docs/SCRIPTS.md) for the full script reference.

## Configuration

### Configuration Summary
- `config/profile.yml` is the main profile file and is created from `config/profile.example.yml`.
- `modes/_profile.md` is the user override file and should be created from `modes/_profile.template.md`.
- `portals.yml` is the scanner configuration copied from `templates/portals.example.yml`.
- `templates/states.yml` defines the canonical tracker statuses.
- `DATA_CONTRACT.md` remains the source of truth for user-layer versus system-layer boundaries.

### Reference
See [`docs/agents/CONFIGURATION.md`](docs/agents/CONFIGURATION.md) for the summarized configuration map, [`docs/CUSTOMIZATION.md`](docs/CUSTOMIZATION.md) for the canonical customization guide, and [`DATA_CONTRACT.md`](DATA_CONTRACT.md) for edit boundaries.

## Architecture

### System Summary
Codex should enter through `AGENTS.md`, then reuse `CLAUDE.md`, `docs/CODEX.md`, and the relevant `modes/*` files. Single-offer flows generate a report, PDF, and tracker addition. Scanner flows read `portals.yml` through `scan.mjs`. Batch flows use `batch/batch-runner.sh` and `batch/batch-prompt.md`. Tracker additions are merged into `data/applications.md`, and the dashboard reads the local tracker state from `dashboard/`.

### Reference
See [`docs/agents/SYSTEM_ARCHITECTURE.md`](docs/agents/SYSTEM_ARCHITECTURE.md) for the condensed system reference and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the canonical architecture walkthrough.

## Contributing

### Expectations
Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before proposing non-trivial changes. The repository asks contributors to open an issue first, avoid committing personal data, respect the no-auto-submit rule, and avoid disallowed scraping or unapproved external API dependencies.

### Reference
See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

### Reference
Career-Ops is released under the MIT License in [`LICENSE`](LICENSE). Related project policies live in [`LEGAL_DISCLAIMER.md`](LEGAL_DISCLAIMER.md), [`SECURITY.md`](SECURITY.md), [`SUPPORT.md`](SUPPORT.md), and [`GOVERNANCE.md`](GOVERNANCE.md).
