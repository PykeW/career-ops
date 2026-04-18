# Backend

Dedicated local API service for the separated frontend/backend workflow.

The primary local app entrypoints now live at the repository root:

- `npm run backend:dev` for the API only
- `npm run frontend:dev` for the Vite app only
- `npm run dev` to run both together from the root directory

`npm run web` still works, but it only forwards to `backend/server.mjs` as a deprecated compatibility shim. The split `backend/` + `frontend/` layout is the main development path.

## Dev commands

```bash
npm run backend:dev
npm run backend:start
npm run backend:check
```

If you also need the frontend locally, install its dependencies once and then use the root wrappers:

```bash
npm install --prefix frontend
npm run frontend:dev
npm run dev
```

Defaults:

- Host: `127.0.0.1`
- Port: `8787`
- API base URL: `http://127.0.0.1:8787/api`

## Environment overrides

- `BACKEND_HOST`
- `BACKEND_PORT` or `PORT`
- `BACKEND_CORS_ORIGINS` comma-separated list
- `CAREER_OPS_ROOT_DIR`
- `CAREER_OPS_CV_PATH`
- `CAREER_OPS_PROFILE_PATH`
- `CAREER_OPS_OUTPUT_DIR`

The markdown resume flow no longer depends on `templates/cv-template.html` or `generate-pdf.mjs`; those files remain in the repo for the original PDF pipeline but are not part of the backend runtime contract.

## API

- `GET /api/health`
- `GET /api/cv`
- `PUT /api/cv`
- `GET /api/profile`
- `POST /api/resume/generate`
- `GET /api/resume/download/:fileName`

`PUT /api/cv` accepts `content` as the canonical request body field. Aliases accepted for compatibility: `cvContent`, `cv`, `markdown`.

`POST /api/resume/generate` requires `jobDescription`. Optional fields: `company`, `companyName`, `targetRole`, `role`. The backend saves a tailored `.md` resume in `output/`, returns the generated content inline, and provides a markdown download path. It only reorganizes/highlights material already present in `cv.md`.
