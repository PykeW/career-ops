# Getting Started

This guide condenses the checked-in setup flow for Codex and Claude users while keeping the detailed setup docs linked for deeper context.

[AGENTS](../../AGENTS.md) · [Overview](../../AGENTS.md#getting-started) · [Development](DEVELOPMENT_WORKFLOW.md) · [Configuration](CONFIGURATION.md)

## On this page

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [First Run](#first-run)
- [Verification](#verification)

## Prerequisites

- A Codex client that reads `../../AGENTS.md` or Claude Code configured for this repository.
- Node.js 18+ for the root automation scripts.
- Playwright Chromium for PDF generation and browser-based verification.
- Optional: Go 1.24.2 if you want to run dashboard `go` commands directly; prefer `npm run dashboard:build`, which prepends `.tools/go/bin` before any system Go.
- If you plan to use batch processing, `../../batch/README.md` expects a working `claude` CLI in `PATH`.

## Installation

```bash
npm install
npx playwright install chromium
```

## First Run

1. Create the user profile from the checked-in template:

```bash
cp config/profile.example.yml config/profile.yml
cp modes/_profile.template.md modes/_profile.md
cp templates/portals.example.yml portals.yml
```

2. Add the root user files expected by the workflows:

   - `cv.md` for the canonical CV
   - `article-digest.md` for optional proof points

3. Edit `config/profile.yml`, `modes/_profile.md`, and `portals.yml` with your targets, narrative, and scanner preferences.

4. Start from your preferred client:
   - Run `claude` in this repository for Claude Code.
   - Use a Codex client that reads `../../AGENTS.md` and routes through `../CODEX.md`.

## Verification

```bash
npm run doctor
npm run verify
npm run sync-check
```

Optional dashboard validation:

```bash
npm run dashboard:build
./dashboard/career-dashboard --path .
```

`npm run dashboard:build` prefers the workspace-local Go toolchain in `.tools/go/bin` before any system `go`.

For the fuller setup walkthrough, see [docs/SETUP.md](../SETUP.md) and [docs/CODEX.md](../CODEX.md).

## Related

- [AGENTS](../../AGENTS.md)
- [Overview](../../AGENTS.md#getting-started)
- [Development](DEVELOPMENT_WORKFLOW.md)
- [Configuration](CONFIGURATION.md)
