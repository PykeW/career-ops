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

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

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

export function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': MIME_TYPES['.json'],
  });
  response.end(body);
}

export function sendError(response, statusCode, message, extra = {}) {
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

export function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;

  if (details !== undefined) {
    error.details = details;
  }

  return error;
}

export function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function pickFirstString(body, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = body?.[fieldName];

    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return '';
}

export function parseCorsOrigins(env = process.env) {
  const configuredOrigins = env.BACKEND_CORS_ORIGINS
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return configuredOrigins?.length ? configuredOrigins : DEFAULT_CORS_ORIGINS;
}

export function buildCorsOptions(env = process.env) {
  const allowedOrigins = parseCorsOrigins(env);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(createHttpError(403, `Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'PUT', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86400,
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = error?.message || 'Internal server error';

  const payload = {
    error: message,
  };

  if (error?.details !== undefined) {
    payload.details = error.details;
  }

  if (status >= 500) {
    console.error('[backend] request failed', {
      method: req.method,
      path: req.originalUrl,
      status,
      message,
      stack: error?.stack,
    });
  }

  res.status(status).json(payload);
}