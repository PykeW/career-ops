#!/usr/bin/env node

import { createServer } from 'http';
import { access, stat } from 'fs/promises';
import { extname } from 'path';

import { readCvFile, readProfileInfo, writeCvFile } from './lib/data.mjs';
import { methodNotAllowed, readJsonBody, resolveSafePath, sendError, sendFile, sendJson } from './lib/http.mjs';
import { generateTailoredResume } from './lib/resume.mjs';
import { backendDir, fontsDir, outputDir, projectRoot } from './lib/project-paths.mjs';

const host = process.env.BACKEND_HOST || process.env.HOST || '127.0.0.1';
const port = normalizePort(process.env.BACKEND_PORT || process.env.PORT || '4312');
const allowedOrigins = parseAllowedOrigins(process.env.BACKEND_CORS_ORIGIN || process.env.CORS_ORIGIN || '*');

const server = createServer(async (request, response) => {
  applyCorsHeaders(request, response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    if (pathname === '/' || pathname === '/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'career-ops-backend',
        backendDir,
        projectRoot,
        routes: [
          'GET /health',
          'GET /api/cv',
          'PUT /api/cv',
          'GET /api/profile',
          'POST /api/resume/generate',
          'GET /output/:file',
          'GET /downloads/:file',
        ],
      });
      return;
    }

    if (pathname === '/api/cv') {
      await handleCvRoute(request, response);
      return;
    }

    if (pathname === '/api/profile') {
      await handleProfileRoute(request, response);
      return;
    }

    if (pathname === '/api/resume/generate') {
      await handleGenerateRoute(request, response);
      return;
    }

    if (pathname.startsWith('/downloads/')) {
      await serveDownload(response, pathname.slice('/downloads'.length));
      return;
    }

    if (pathname.startsWith('/output/fonts/')) {
      await serveFromDirectory(response, fontsDir, pathname.slice('/output/fonts'.length));
      return;
    }

    if (pathname.startsWith('/output/')) {
      await serveFromDirectory(response, outputDir, pathname.slice('/output'.length));
      return;
    }

    if (pathname.startsWith('/fonts/')) {
      await serveFromDirectory(response, fontsDir, pathname.slice('/fonts'.length));
      return;
    }

    sendError(response, 404, 'Route not found.');
  } catch (error) {
    sendError(response, error.statusCode || 500, error.message || 'Unexpected server error.');
  }
});

server.listen(port, host, () => {
  console.log(`career-ops backend listening on http://${host}:${port}`);
  console.log(`Backend dir: ${backendDir}`);
  console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
});

async function handleCvRoute(request, response) {
  if (request.method === 'GET') {
    const cv = await readCvFile();
    sendJson(response, 200, { content: cv.content });
    return;
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody(request);
    if (typeof body.content !== 'string') {
      sendError(response, 400, 'content must be a string.');
      return;
    }

    const saved = await writeCvFile(body.content);
    sendJson(response, 200, { ok: true, content: saved.content, path: saved.path });
    return;
  }

  methodNotAllowed(response, ['GET', 'PUT']);
}

async function handleProfileRoute(request, response) {
  if (request.method !== 'GET') {
    methodNotAllowed(response, ['GET']);
    return;
  }

  const cv = await readCvFile();
  const profile = await readProfileInfo({ cvContent: cv.content });
  sendJson(response, 200, { ok: true, ...profile });
}

async function handleGenerateRoute(request, response) {
  if (request.method !== 'POST') {
    methodNotAllowed(response, ['POST']);
    return;
  }

  const body = await readJsonBody(request);
  const result = await generateTailoredResume(body);
  sendJson(response, 200, result);
}

async function serveDownload(response, requestPath) {
  const safePath = resolveSafePath(outputDir, requestPath);
  if (!safePath || extname(safePath).toLowerCase() !== '.pdf') {
    sendError(response, 404, 'File not found.');
    return;
  }

  await assertFileExists(safePath);
  response.setHeader('Content-Disposition', `attachment; filename="${safePath.split('/').pop()}"`);
  await sendFile(response, safePath);
}

async function serveFromDirectory(response, baseDir, requestPath) {
  const safePath = resolveSafePath(baseDir, requestPath);
  if (!safePath || !(await isFile(safePath))) {
    sendError(response, 404, 'File not found.');
    return;
  }

  await sendFile(response, safePath);
}

function applyCorsHeaders(request, response) {
  const requestOrigin = request.headers.origin;
  const origin = resolveCorsOrigin(requestOrigin);

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  response.setHeader('Access-Control-Max-Age', '86400');
  response.setHeader('Vary', 'Origin');
}

function resolveCorsOrigin(requestOrigin) {
  if (allowedOrigins.includes('*')) {
    return '*';
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] || '*';
}

function parseAllowedOrigins(value) {
  return String(value || '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function assertFileExists(filePath) {
  try {
    await access(filePath);
  } catch {
    const error = new Error('File not found.');
    error.statusCode = 404;
    throw error;
  }
}

async function isFile(filePath) {
  try {
    const fileStats = await stat(filePath);
    return fileStats.isFile();
  } catch {
    return false;
  }
}

function normalizePort(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 4312;
}
