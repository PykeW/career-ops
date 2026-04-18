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

Accepted compatibility aliases:

- `jdText`
- `description`
- `companyName`
- `role`

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

Compatibility aliases remain available in the backend response for gradual migration:

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

Compatibility aliases remain available for migration:

- `filename`
- `downloadUrl`
- `content`
- `markdown`
- `companyName`
- `role`

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

- New code should read canonical fields first.
- Existing aliases stay in place until all clients migrate.
- New backend fields should be added to the shared contract helpers before being consumed directly in the UI.
