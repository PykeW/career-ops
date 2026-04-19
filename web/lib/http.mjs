import { readFile } from 'fs/promises';
import { extname, resolve, sep } from 'path';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

export async function readJsonBody(request, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': MIME_TYPES['.json'],
  });
  response.end(body);
}

function sendError(response, statusCode, message, extra = {}) {
  sendJson(response, statusCode, {
    ok: false,
    error: message,
    ...extra,
  });
}

export async function sendFile(response, filePath) {
  const content = await readFile(filePath);
  const mimeType = MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Length': content.length,
    'Content-Type': mimeType,
  });
  response.end(content);
}

export function resolveSafePath(baseDir, requestPath) {
  const resolvedPath = resolve(baseDir, `.${requestPath}`);
  if (resolvedPath === baseDir || resolvedPath.startsWith(`${baseDir}${sep}`)) {
    return resolvedPath;
  }
  return null;
}

export function methodNotAllowed(response, allowedMethods) {
  response.setHeader('Allow', allowedMethods.join(', '));
  sendError(response, 405, 'Method not allowed.');
}
