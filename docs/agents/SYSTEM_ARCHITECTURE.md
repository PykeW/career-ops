# Architecture

This reference summarizes how the checked-in modes, scripts, templates, and data files fit together.

## High-Level Design

- `../../AGENTS.md` is the Codex entrypoint and routes readers into `../../CLAUDE.md`, `../../DATA_CONTRACT.md`, and `../CODEX.md`.
- `../CODEX.md` maps user intent to `../../modes/_shared.md` plus the workflow-specific mode file.
- Root `.mjs` scripts handle scanning, PDF generation, liveness checks, tracker normalization, tracker merging, and pipeline verification.
- The repository keeps tracker data, reports, PDFs, and saved job descriptions in local files rather than a remote application service.

## Major Components

| Component | Repository anchors | Responsibility |
|-----------|--------------------|----------------|
| Mode layer | `../../modes/` | Defines workflow prompts and routing for evaluation, scanning, PDF generation, tracking, and adjacent workflows. |
| Scanner | `../../scan.mjs`, `../../templates/portals.example.yml` | Discovers relevant roles from configured companies and search queries. |
| PDF generation | `../../generate-pdf.mjs`, `../../templates/cv-template.html`, `../../fonts/` | Produces ATS-oriented CV PDFs from repository inputs. |
| Batch pipeline | `../../batch/batch-runner.sh`, `../../batch/batch-prompt.md`, `../../batch/README.md` | Runs multiple evaluations in parallel and records worker state. |
| Tracker maintenance | `../../merge-tracker.mjs`, `../../verify-pipeline.mjs`, `../../normalize-statuses.mjs`, `../../dedup-tracker.mjs` | Keeps `data/applications.md` consistent and canonical. |
| Dashboard | `../../dashboard/main.go` | Provides a terminal UI for browsing and updating tracker state. |

## Data Flow

### Single Offer Flow

1. A user provides JD text or a job URL.
2. The workflow extracts the job content and classifies the role.
3. Evaluation writes a markdown report under `reports/` and prepares personalization for the CV.
4. `generate-pdf.mjs` renders the ATS-oriented PDF into `output/`.
5. Tracker additions are merged into `data/applications.md` through the checked-in merge flow.

### Scanner Flow

1. `portals.yml` provides title filters, search queries, and tracked companies.
2. `scan.mjs` checks supported sources and filters results against the configured role criteria.
3. Matching results are surfaced to stdout and can feed the repository pipeline/tracker flow described in `../SCRIPTS.md` and `../ARCHITECTURE.md`.

### Batch and Tracker Flow

1. `batch/batch-runner.sh` reads `batch-input.tsv` and `batch-state.tsv`.
2. The runner launches `claude -p` workers with `batch-prompt.md`.
3. Workers write reports, PDFs, logs, and TSV tracker additions.
4. `merge-tracker.mjs` merges those additions into `data/applications.md`, then `verify-pipeline.mjs` validates the result.

## External Boundaries

- Playwright Chromium is the browser boundary for PDF generation and reliable job verification.
- The scanner template documents direct careers-page access, structured Greenhouse API access, and broader WebSearch-based discovery.
- `../CODEX.md` says new tracker rows should flow through TSV additions and `merge-tracker.mjs`, not direct manual insertion into `data/applications.md`.
- `../../CLAUDE.md` and `../../CONTRIBUTING.md` both reinforce the same human-in-the-loop rule: the system can prepare applications, but it should not submit them automatically.

For the canonical architecture walkthrough, see `../ARCHITECTURE.md`.
