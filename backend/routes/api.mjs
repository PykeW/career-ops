import { access, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import express from 'express';

import { getCvDocument, getProfileDocument, saveCvDocument } from '../lib/data.mjs';
import { createHttpError, asyncHandler } from '../lib/http.mjs';
import { getProjectPaths } from '../lib/project-paths.mjs';
import { generateResume } from '../lib/resume.mjs';
import { normalizeCvRequest } from '../../shared/contracts/api-contract.mjs';

export function createApiRouter(env = process.env) {
  const router = express.Router();
  const paths = getProjectPaths(env);

  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: 'career-ops-backend',
    });
  });

  router.get('/cv', asyncHandler(async (req, res) => {
    const cvDocument = await getCvDocument(paths);
    res.json(cvDocument);
  }));

  router.put('/cv', asyncHandler(async (req, res) => {
    const cvRequest = normalizeCvRequest(req.body);

    if (!cvRequest.provided) {
      throw createHttpError(400, 'Request body must include a string field named `content`');
    }

    const cvDocument = await saveCvDocument(paths, cvRequest.content);
    res.json(cvDocument);
  }));

  router.get('/profile', asyncHandler(async (req, res) => {
    const profileDocument = await getProfileDocument(paths);
    res.json(profileDocument);
  }));

  router.post('/resume/generate', asyncHandler(async (req, res) => {
    const result = await generateResume(paths, req.body);

    res.status(201).json(result);
  }));

  router.get('/resume/download/:fileName', asyncHandler(async (req, res) => {
    const { fileName } = req.params;

    if (!fileName || basename(fileName) !== fileName) {
      throw createHttpError(400, 'Invalid resume file name');
    }

    const filePath = join(paths.outputDir, fileName);

    try {
      await access(filePath);
    } catch {
      throw createHttpError(404, `Resume file not found: ${fileName}`);
    }

    const fileBuffer = await readFile(filePath);

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.type('text/markdown; charset=utf-8');
    res.send(fileBuffer);
  }));

  return router;
}
