# Project Name

Career-Ops

# Overview

Career-Ops is an AI-powered job-search pipeline built on Claude Code. The repository evaluates job descriptions or URLs, generates ATS-oriented PDFs, scans portals, processes offers in batch, and tracks applications with markdown and TSV-based workflows.

For Codex compatibility, treat this file as the entry point, then read `CLAUDE.md`, `DATA_CONTRACT.md`, and `docs/CODEX.md`. Reuse the checked-in modes, scripts, templates, and tracker flow rather than creating a parallel automation layer. Keep user-specific customization in `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, or `portals.yml`, never in `modes/_shared.md`, and never submit an application on the user's behalf.

# Technology Stack

- Node.js 18+ for the main automation and maintenance scripts.
- JavaScript ES modules (`*.mjs`) for scanning, verification, PDF generation, tracker maintenance, update checks, and related utilities.
- Playwright for browser-based job extraction and PDF rendering.
- `js-yaml` for YAML-backed configuration such as `portals.yml`.
- Go for the optional dashboard in `dashboard/`; `docs/SETUP.md` says Go 1.21+ and `dashboard/go.mod` currently declares `go 1.24.2`.
- Bubble Tea and Lip Gloss for the dashboard TUI.
- Markdown, YAML, HTML, TSV, and plain text files as the main documentation, configuration, and data formats.
- Optional Nix and direnv support via `.envrc` and `flake.nix`.

# Project Structure

```text
career-ops/
├── AGENTS.md
├── CLAUDE.md
├── DATA_CONTRACT.md
├── README.md
├── package.json
├── .claude/skills/          # Claude skill definitions
├── .opencode/commands/      # OpenCode command entrypoints
├── config/                  # Profile templates and user config
├── templates/               # CV template, portal template, canonical states
├── modes/                   # Shared modes plus language variants
├── batch/                   # Batch prompts, state, logs, and runner script
├── dashboard/               # Optional Go TUI application
├── docs/                    # Setup, architecture, Codex, and other docs
├── data/                    # Tracker and pipeline data
├── reports/                 # Generated evaluation reports
├── output/                  # Generated PDFs and other outputs
├── interview-prep/          # Story bank and interview research
├── examples/                # Sample user-facing files
├── fonts/                   # Fonts used by PDF generation
└── *.mjs                    # Core Node-based utilities and pipeline scripts
```

# Key Features

- Auto-pipeline flow for a pasted job description or job URL.
- Structured offer evaluation documented around the A-F scoring flow in `docs/ARCHITECTURE.md`.
- ATS-oriented PDF generation through `generate-pdf.mjs` and `templates/cv-template.html`.
- Portal scanning through `scan.mjs` with YAML configuration and API-backed discovery for supported portals.
- Batch processing through `batch/batch-runner.sh` and `claude -p` workers.
- Interview-prep artifacts, story-bank accumulation, and negotiation guidance described in the repository docs.
- Human-in-the-loop guardrails: the system evaluates and recommends, but does not auto-submit applications.
- Pipeline integrity tooling for merge, deduplication, normalization, liveness, and verification.
- Optional Go dashboard for browsing, filtering, sorting, previewing, and updating application status.

# Getting Started

1. Install dependencies:

```bash
npm install
npx playwright install chromium
```

2. Create your user-layer files:

```bash
cp config/profile.example.yml config/profile.yml
cp templates/portals.example.yml portals.yml
```

3. Add the remaining personal inputs in the repository root as needed:
- `cv.md` for the candidate CV.
- `article-digest.md` for optional proof points.
- `modes/_profile.md` for user-specific mode customization.

4. Validate the setup:

```bash
npm run doctor
npm run verify
npm run sync-check
```

5. Start from your preferred client in this repository:
- Claude Code usage is documented in `README.md` and `docs/SETUP.md`.
- Codex usage is documented in `docs/CODEX.md`; the routing map points Codex to the existing `modes/*` files.

6. Optional: build the dashboard:

```bash
cd dashboard && go build -o career-dashboard .
./career-dashboard --path ..
```

# Development

- There is no top-level `build` or `test` npm script in `package.json`; the repository relies on targeted maintenance and verification scripts instead.
- Main npm scripts are:
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
- Main user-facing slash commands documented in `README.md` are `/career-ops`, `/career-ops scan`, `/career-ops pdf`, `/career-ops batch`, `/career-ops tracker`, `/career-ops apply`, `/career-ops pipeline`, `/career-ops contacto`, `/career-ops deep`, `/career-ops training`, and `/career-ops project`.
- OpenCode command entrypoints live in `.opencode/commands/` and currently cover the same core flows as the checked-in command files there.
- If you change the dashboard, build it with `cd dashboard && go build -o career-dashboard .`.
- `CONTRIBUTING.md` recommends testing changes with a fresh clone and treating personal data files as out of bounds for commits.

# Configuration

- `config/profile.example.yml` is the template for `config/profile.yml` and includes `candidate`, `target_roles`, `narrative`, `compensation`, and `location` sections, plus an optional Canva resume design ID.
- `templates/portals.example.yml` is the scanner template. It documents scanner strategy, `title_filter`, `search_queries`, and `tracked_companies`; users copy it to `portals.yml` in the root.
- `templates/states.yml` defines the canonical application states used by both the tracker writer and the dashboard.
- `modes/_profile.md`, `config/profile.yml`, `article-digest.md`, and `portals.yml` are the intended homes for personalization.
- `DATA_CONTRACT.md` defines the user layer versus the system layer. Treat it and `CLAUDE.md` as the source of truth when deciding where edits belong.
- `modes/` includes language-specific directories such as `modes/de`, `modes/fr`, `modes/ja`, `modes/pt`, and `modes/ru` in addition to the default top-level mode files.
- `.envrc` and `flake.nix` provide an optional Nix-based development shell with Playwright-related environment settings.

# Architecture

The repository follows an agent-driven architecture documented in `docs/ARCHITECTURE.md` and `docs/CODEX.md`.

- Entry and routing: Codex should use `AGENTS.md` as the entry point, then route into `CLAUDE.md`, `modes/_shared.md`, and the relevant mode file for the requested workflow.
- Single-offer flow: a pasted JD or URL is extracted, classified, evaluated, written to `reports/`, converted to a PDF, and tracked.
- Scanner flow: `scan.mjs` reads `portals.yml`, detects supported portal APIs, filters titles, deduplicates against tracker and history files, and appends new work to the pipeline.
- Batch flow: `batch/batch-runner.sh` reads `batch-input.tsv`, `batch-prompt.md`, and `batch-state.tsv`, writes per-offer logs and tracker additions, and supports parallelism, retries, and resumability.
- Tracker flow: TSV additions are merged into `data/applications.md`; per `docs/CODEX.md`, do not add new tracker rows directly to `data/applications.md`.
- Dashboard flow: `dashboard/main.go` loads applications, computes metrics, enriches report summaries, opens report views and URLs, and supports inline status updates.
- Data flow: `cv.md`, `article-digest.md`, `config/profile.yml`, `portals.yml`, `templates/states.yml`, and `templates/cv-template.html` provide the main pipeline inputs.

# Contributing

- Read `CONTRIBUTING.md` before proposing repository changes.
- Open an issue first for non-trivial contributions.
- Keep changes aligned with the existing architecture and the project's stated philosophy of simple, minimal, quality-focused changes.
- Do not commit personal data such as real CVs, populated profile files, tracker data, reports, or other user-specific artifacts.
- Respect the project boundaries in `CONTRIBUTING.md`: do not add prohibited scraping for disallowed platforms, do not enable automatic application submission, and do not introduce external API dependencies without prior discussion.

# License

This project is licensed under the MIT License. See `LICENSE` for the full text. For related project policies, also review `LEGAL_DISCLAIMER.md`, `SECURITY.md`, `SUPPORT.md`, and `GOVERNANCE.md`.
