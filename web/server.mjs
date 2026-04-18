#!/usr/bin/env node

process.emitWarning(
  '`web/server.mjs` is deprecated and only kept as a compatibility shim. Use `npm run backend:start`, `npm run backend:dev`, or `npm run dev` instead.',
  { code: 'CAREER_OPS_WEB_SHIM_DEPRECATED' }
);

await import('../backend/server.mjs');
