import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import yaml from 'js-yaml';

import { createHttpError } from './http.mjs';
import { toProjectRelativePath } from './project-paths.mjs';

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n');
}

export async function getCvDocument(paths) {
  const relativePath = toProjectRelativePath(paths.rootDir, paths.cvPath);

  if (!(await fileExists(paths.cvPath))) {
    return {
      exists: false,
      content: '',
      path: relativePath,
    };
  }

  const content = await readFile(paths.cvPath, 'utf8');

  return {
    exists: true,
    content,
    path: relativePath,
  };
}

export async function saveCvDocument(paths, content) {
  if (typeof content !== 'string') {
    throw createHttpError(400, 'Request body field `content` must be a string');
  }

  await mkdir(dirname(paths.cvPath), { recursive: true });
  await writeFile(paths.cvPath, normalizeLineEndings(content), 'utf8');

  return getCvDocument(paths);
}

export async function getProfileDocument(paths) {
  const relativePath = toProjectRelativePath(paths.rootDir, paths.profilePath);

  if (!(await fileExists(paths.profilePath))) {
    return {
      exists: false,
      path: relativePath,
      profile: null,
      raw: '',
    };
  }

  const raw = await readFile(paths.profilePath, 'utf8');

  try {
    return {
      exists: true,
      path: relativePath,
      profile: raw.trim() ? yaml.load(raw) ?? null : null,
      raw,
    };
  } catch (error) {
    throw createHttpError(
      500,
      `Failed to parse profile YAML at ${relativePath}`,
      error.message
    );
  }
}

