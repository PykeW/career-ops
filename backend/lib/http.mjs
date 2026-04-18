import { buildErrorPayload } from '../../shared/contracts/api-contract.mjs';

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

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
  res.status(404).json(
    buildErrorPayload('Not found', { path: req.originalUrl })
  );
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = Number.isInteger(error?.status) ? error.status : 500;
  const message = error?.message || 'Internal server error';
  const payload = buildErrorPayload(message, error?.details);

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
