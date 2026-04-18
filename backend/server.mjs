import express from 'express';
import cors from 'cors';

import { createApiRouter } from './routes/api.mjs';
import { buildCorsOptions, errorHandler, notFoundHandler } from './lib/http.mjs';
import { getProjectPaths, toProjectRelativePath } from './lib/project-paths.mjs';

const app = express();
const port = Number(process.env.BACKEND_PORT || process.env.PORT || 8787);
const host = process.env.BACKEND_HOST || '127.0.0.1';
const paths = getProjectPaths(process.env);

app.use(cors(buildCorsOptions(process.env)));
app.use(express.json({ limit: '2mb' }));

app.get('/', (req, res) => {
  res.json({
    ok: true,
    service: 'career-ops-backend',
    apiBaseUrl: `http://${host}:${port}/api`,
    artifactType: 'markdown',
    sourcePaths: {
      cv: toProjectRelativePath(paths.rootDir, paths.cvPath),
      profile: toProjectRelativePath(paths.rootDir, paths.profilePath),
      outputDir: toProjectRelativePath(paths.rootDir, paths.outputDir),
    },
  });
});

app.use('/api', createApiRouter(process.env));
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, host, () => {
  console.log(`[backend] listening on http://${host}:${port}`);
});
