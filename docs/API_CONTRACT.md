# Shared API Contract

This document defines the canonical frontend/backend payload shapes for the split `backend/` + `frontend/` app while preserving compatibility with older aliases.

## Canonical request shapes

### `PUT /api/cv`

Canonical request body:

```json
{
  "content": "# Markdown CV"
}
```

Accepted compatibility aliases:

- `cvContent`
- `cv`
- `markdown`

### `POST /api/resume/generate`

Canonical request body:

```json
{
  "jobDescription": "...",
  "company": "Optional company",
  "targetRole": "Optional role"
}
```

Only canonical request fields are accepted.

## Canonical response shapes

### `GET /api/cv` and `PUT /api/cv`

Canonical response:

```json
{
  "exists": true,
  "path": "cv.md",
  "content": "# Markdown CV"
}
```

The canonical backend response is shown above. Shared contract helpers still normalize the following legacy aliases during migration if older payloads surface:

- `cvContent`
- `cv`
- `markdown`

### `GET /api/profile`

Top-level response keeps the existing `profile` + `raw` structure and now adds a stable `snapshot`:

```json
{
  "exists": true,
  "path": "config/profile.yml",
  "profile": { "candidate": {} },
  "raw": "candidate:\n  ...",
  "snapshot": {
    "name": "Candidate",
    "headline": "...",
    "email": "...",
    "location": "...",
    "linkedinLabel": "...",
    "linkedinUrl": "...",
    "portfolioLabel": "...",
    "portfolioUrl": "...",
    "github": "...",
    "targetRoles": ["..."],
    "hasProfile": true,
    "source": "config/profile.yml",
    "notes": []
  }
}
```

### `POST /api/resume/generate`

Canonical response fields:

```json
{
  "ok": true,
  "artifactType": "markdown",
  "contentType": "text/markdown; charset=utf-8",
  "language": "en",
  "fileName": "resume-...md",
  "downloadPath": "/api/resume/download/resume-...md",
  "outputPath": "output/resume-...md",
  "previewMarkdown": "# Tailored Resume ...",
  "company": "Optional company",
  "targetRole": "Optional role",
  "message": "Tailored Markdown resume ready ...",
  "keywords": ["..."],
  "notes": [],
  "sourceCvPath": "cv.md",
  "sourceProfilePath": "config/profile.yml",
  "generatedAt": "2026-04-19T...Z"
}
```

Only canonical response fields are supported.

## Error payload

All error responses should conform to:

```json
{
  "error": "Human-readable message",
  "details": {}
}
```

`details` is optional and can carry structured context such as not-found metadata.

## Shared implementation

The shared contract layer lives in:

- `shared/contracts/api-contract.mjs` for backend/runtime normalization and response builders
- `shared/contracts/api-contract.ts` for frontend/client helpers and types
- `shared/contracts/api-contract.d.ts` for lightweight cross-project typing support

Backend usage currently includes:

- request normalization in `backend/routes/api.mjs`
- stable CV/profile response builders in `backend/lib/data.mjs`
- stable resume result builder in `backend/lib/resume.mjs`
- canonical error payload builder in `backend/lib/http.mjs`

Frontend usage currently includes:

- canonical-first parsing and request builders in `frontend/src/lib/api.ts`
- canonical request construction in `frontend/src/App.tsx`

## Migration guidance

- New frontend code should write canonical request fields only (`content`, `jobDescription`, `company`, `targetRole`) and read canonical response fields first.
- Resume generate request/response aliases have been removed from `shared/contracts/api-contract.*`. Do not reintroduce alias parsing or alias emission in `backend/`, `frontend/`, or legacy web clients.
- When the contract changes, update `shared/contracts/api-contract.mjs`, `shared/contracts/api-contract.ts`, and `shared/contracts/api-contract.d.ts` together, then align backend/frontend consumers and this document in the same PR.
- Before removing an alias or old response shape, confirm split-app smoke passes (`npm run backend:check`, `npm run frontend:install && npm run frontend:build`, and `node test-all.mjs --quick`) and call out the removal in the PR notes/checklist.
- Keep `web/server.mjs` as a thin deprecated shim only; contract logic belongs in `backend/`, `frontend/`, and `shared/contracts/`.
