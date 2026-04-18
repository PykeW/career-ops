# Career-Ops

Maintainer-facing guide to the local-first job-search automation repository, its runtime surfaces, and its update boundaries.

## Project Name

**Career-Ops** — an agent-assisted repository for evaluating roles, generating tailored resumes, scanning portals, and maintaining a local application pipeline.

## Overview

Career-Ops is a local-first repository that combines prompt-driven workflows, automation scripts, a split frontend/backend application, and optional terminal tooling into a single job-search operations system. It evaluates pasted job descriptions or URLs, generates tailored ATS-oriented resume artifacts, scans portals for relevant openings, and keeps tracker data consistent through merge, normalization, deduplication, and verification scripts.

For maintainers and coding agents, this file is the primary orientation document. Read it together with `CLAUDE.md`, `DATA_CONTRACT.md`, `docs/ARCHITECTURE.md`, and `docs/API_CONTRACT.md` before making non-trivial changes. The repository stores user-owned data in local markdown, YAML, TSV, and generated artifacts, while system-layer scripts, templates, and docs remain updateable under the rules defined in `DATA_CONTRACT.md`.

The repository is intentionally human-in-the-loop. Automation may evaluate, draft, personalize, organize, and recommend, but it must not auto-submit applications. Personalization belongs in user-layer files such as `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, `portals.yml`, and tracker data under `data/`, while shared scripts, templates, and docs should stay system-layer and update-safe.

## Technology Stack

- **Language / Runtime**
  - Node.js 18+
  - JavaScript ES modules (`*.mjs`) for the main automation scripts
  - TypeScript for the dedicated frontend
  - Go 1.24.2 for the optional terminal dashboard
- **Frameworks**
  - Express 5 backend (`backend/`)
  - React 18 + Vite frontend (`frontend/`)
  - Playwright for PDF generation and job verification/liveness checks
  - Bubble Tea + Lip Gloss for the dashboard TUI
- **Key Dependencies**
  - `express`, `cors`, `js-yaml`, `playwright`
  - `react`, `react-dom`, `typescript`, `vite`
- **Build / Tooling**
  - npm scripts from the repository root
  - TypeScript build via `npm --prefix frontend run build`
  - Go toolchain for `dashboard/`
  - Optional `direnv` + Nix via `.envrc` and `flake.nix`

## Project Structure

```text
career-ops/
├── AGENTS.md                    # Root agent-facing project guide
├── CLAUDE.md                    # Canonical agent workflow rules and onboarding
├── DATA_CONTRACT.md             # User-layer vs system-layer boundaries
├── README.md                    # Main product-facing documentation
├── package.json                 # Root scripts for pipeline, backend, frontend, and tooling
├── backend/                     # Express API for CV/profile/resume operations
│   ├── lib/                     # Data, HTTP, path, and resume helpers
│   └── routes/                  # API route definitions
├── frontend/                    # Vite + React split-app UI
│   ├── src/components/          # UI panels/cards
│   ├── src/hooks/               # Request lifecycle and state hooks
│   └── src/lib/                 # API helpers and shared UI state helpers
├── shared/contracts/            # Canonical frontend/backend request-response contract
├── web/                         # Deprecated compatibility shim forwarding to backend
├── batch/                       # Batch prompt, runner, logs, and tracker additions
├── dashboard/                   # Optional Go terminal UI for tracker browsing/updates
├── config/                      # Profile template and local user profile
├── templates/                   # PDF, portal-scanner, and canonical status templates
├── modes/                       # Workflow prompts and language-specific variants
├── docs/                        # Setup, scripts, API contract, architecture, customization
│   └── agents/                  # Focused agent-facing reference docs
├── data/                        # Local tracker and pipeline state
├── reports/                     # Generated evaluation reports
├── output/                      # Generated resumes/PDFs and related artifacts
├── interview-prep/              # Story-bank and company interview notes
├── jds/                         # Saved job descriptions
├── fonts/                       # Self-hosted fonts for PDF generation
└── *.mjs                        # Root automation and validation scripts
```

Useful supporting references:

- `docs/agents/PROJECT_STRUCTURE.md`
- `docs/agents/KEY_FEATURES.md`
- `docs/agents/DEVELOPMENT_WORKFLOW.md`
- `docs/agents/CONFIGURATION.md`
- `docs/agents/SYSTEM_ARCHITECTURE.md`

## Key Features

- Auto-pipeline evaluation for a pasted job description or job URL
- Structured multi-block offer analysis and markdown report generation
- ATS-oriented resume/PDF generation from repository inputs
- Dedicated split frontend/backend app for CV editing and tailored markdown resume generation
- Portal scanning with configured companies, queries, and direct ATS/API checks
- Liveness checks for job postings with Playwright-backed verification
- Batch processing with parallel `claude -p` workers and resumable state
- Tracker merge, deduplication, status normalization, and integrity verification
- Optional Go dashboard for browsing, filtering, previewing, and updating application status
- Language-specific mode directories for German, French, Japanese, Portuguese, and Russian workflows

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Playwright Chromium (`npx playwright install chromium`)
- Claude Code or another compatible AI coding CLI for the main agent workflows
- Optional: Go 1.24+ for the dashboard
- Optional: `direnv` / Nix if you want the provided development shell

### Installation

```bash
git clone https://github.com/santifer/career-ops.git
cd career-ops
npm install
npm install --prefix frontend
npx playwright install chromium

cp config/profile.example.yml config/profile.yml
cp modes/_profile.template.md modes/_profile.md
cp templates/portals.example.yml portals.yml
```

Then add your personal files:

- Create `cv.md` in the repository root
- Optionally create `article-digest.md`
- Customize `config/profile.yml`, `modes/_profile.md`, and `portals.yml`

Validate the setup:

```bash
npm run doctor
npm run verify
npm run sync-check
```

### Usage

Basic agent-driven usage:

```bash
claude
# then paste a job URL or JD, or use /career-ops
```

Useful commands:

```bash
npm run scan                  # Scan portals for new opportunities
npm run liveness -- <url>     # Check if a posting still looks active
npm run backend:start         # Start the dedicated backend
npm run frontend:dev          # Start the Vite frontend
npm run dev                   # Start backend + frontend together
```

Batch and dashboard entrypoints:

```bash
./batch/batch-runner.sh
cd dashboard && go build -o career-dashboard . && ./career-dashboard --path ..
```

## Development

### Available Scripts

#### Pipeline and data maintenance

- `npm run doctor` — validate prerequisites and required local files
- `npm run verify` — check tracker/report integrity
- `npm run normalize` — map status aliases to canonical values
- `npm run dedup` — remove duplicate tracker entries
- `npm run merge` — merge batch TSV additions into `data/applications.md`
- `npm run sync-check` — validate CV/profile consistency and prompt safety
- `npm run scan` — run the zero-token portal scanner
- `npm run liveness` — verify whether job URLs still appear active
- `npm run pdf` — render HTML into a PDF via Playwright

#### App and contract workflows

- `npm run backend:start` — start the Express backend
- `npm run backend:dev` — start the backend in watch mode
- `npm run backend:check` — syntax-check the backend route/lib surface
- `npm run frontend:install` — install frontend dependencies from the root
- `npm run frontend:dev` — run the Vite frontend
- `npm run frontend:build` — build the frontend against current shared contracts
- `npm run frontend:preview` — preview the built frontend
- `npm run dev` — run backend + frontend together
- `npm run web` — deprecated compatibility shim; use split-app commands instead

#### Update flow

- `npm run update:check` — check for upstream system updates
- `npm run update` — apply a system-layer update
- `npm run rollback` — restore the last system-layer backup created during update

### Development Workflow

1. Start with `AGENTS.md`, `CLAUDE.md`, and `DATA_CONTRACT.md` to understand boundaries.
2. Keep user-specific data in user-layer files such as `config/profile.yml`, `modes/_profile.md`, `portals.yml`, `data/`, `reports/`, and `output/`.
3. Reuse the checked-in scripts, templates, and modes rather than creating parallel flows.
4. Treat `shared/contracts/api-contract.mjs`, `shared/contracts/api-contract.ts`, and `docs/API_CONTRACT.md` as the canonical contract-first boundary for split-app changes.
5. Keep `web/server.mjs` as a thin deprecated shim only; do not reintroduce business logic there.
6. Review `batch/README.md` and `batch/batch-prompt.md` together when changing batch behavior.
7. Build `dashboard/` after Go UI changes.
8. Follow `CONTRIBUTING.md` for issue-first collaboration, data safety, and prohibited automation.

Recommended validation commands after app or contract changes:

```bash
npm run backend:check
npm run frontend:install
npm run frontend:build
node test-all.mjs --quick
```

Additional references:

- `docs/SCRIPTS.md`
- `docs/SETUP.md`
- `docs/agents/DEVELOPMENT_WORKFLOW.md`

## Configuration

Primary configuration and customization points:

- `config/profile.yml` — main candidate profile (`candidate`, `target_roles`, `narrative`, `compensation`, `location`)
- `modes/_profile.md` — personal override file for archetypes, framing, negotiation, and user-specific guidance
- `portals.yml` — active scanner configuration copied from `templates/portals.example.yml`
- `cv.md` — canonical CV source of truth used by evaluations and resume generation
- `article-digest.md` — optional proof-point source for deeper personalization
- `templates/states.yml` — canonical tracker states used by pipeline scripts and dashboard logic
- `templates/cv-template.html` — HTML template for the original PDF flow
- `templates/portals.example.yml` — starter scanner template with tracked companies and search queries

Backend environment overrides:

- `BACKEND_HOST`
- `BACKEND_PORT` or `PORT`
- `BACKEND_CORS_ORIGINS`
- `CAREER_OPS_ROOT_DIR`
- `CAREER_OPS_CV_PATH`
- `CAREER_OPS_PROFILE_PATH`
- `CAREER_OPS_OUTPUT_DIR`

Optional environment tooling:

- `.envrc` enables `dotenv` + `use flake`
- `flake.nix` provisions a dev shell with Node.js, Bun, coreutils, and Playwright browsers

Boundary rules:

- `DATA_CONTRACT.md` is the source of truth for user-layer vs system-layer ownership
- `CLAUDE.md` directs user-specific customization into `config/profile.yml` and `modes/_profile.md`, not `modes/_shared.md`

## Architecture

At a high level, Career-Ops has five cooperating layers:

1. **Mode and instruction layer** — `modes/`, `CLAUDE.md`, and related docs define how evaluations, scanning, PDF generation, tracking, research, and follow-up flows behave.
2. **Root automation layer** — root `.mjs` scripts handle scanning, liveness checks, PDF generation, tracker merges, normalization, deduplication, verification, and update flows.
3. **Split app layer** — `frontend/src/App.tsx` orchestrates a CV editor, profile snapshot card, and tailored resume generator; `backend/routes/api.mjs` and `backend/lib/*.mjs` provide the API surface.
4. **Shared contract layer** — `shared/contracts/api-contract.*` is the only place where compatibility aliases should intentionally live during migration.
5. **Operational interfaces** — `batch/` provides parallel worker orchestration, `dashboard/` provides a terminal UI, and `web/server.mjs` remains a deprecated forwarding shim.

Typical data flow:

- `cv.md`, `config/profile.yml`, `article-digest.md`, and `portals.yml` provide user context
- A single-offer workflow generates a report, resume/PDF artifact, and tracker addition
- Batch workflows write per-offer outputs and merge tracker entries through `merge-tracker.mjs`
- `data/applications.md` remains the canonical local tracker surface
- Validation scripts (`verify-pipeline.mjs`, `normalize-statuses.mjs`, `dedup-tracker.mjs`) keep the pipeline consistent

Reference docs:

- `docs/ARCHITECTURE.md`
- `docs/agents/SYSTEM_ARCHITECTURE.md`
- `docs/API_CONTRACT.md`

## Contributing

Read `CONTRIBUTING.md` before proposing non-trivial changes. The project expects issue-first collaboration, fresh-clone testing for meaningful changes, and respect for repository boundaries.

Key rules for contributors:

- Do not commit personal data such as real CVs, profile files, trackers, reports, or generated outputs
- Do not add automation that auto-submits applications
- Do not add scraping for platforms that prohibit automated access
- Do not add new external API dependencies without prior discussion
- Keep the split-app contract aligned across `backend/`, `frontend/`, `shared/contracts/`, and `docs/API_CONTRACT.md`

## License

Career-Ops is released under the **MIT License**. See `LICENSE` for the license text.

Related policy documents:

- `LEGAL_DISCLAIMER.md`
- `SECURITY.md`
- `SUPPORT.md`
- `GOVERNANCE.md`
