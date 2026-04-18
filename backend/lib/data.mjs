import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import yaml from 'js-yaml';

import { createHttpError } from './http.mjs';
import { cvPath, profilePath, toProjectRelativePath } from './project-paths.mjs';

const parseYaml = yaml.load;

export async function fileExists(filePath) {
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

export async function readCvFile() {
  if (!(await fileExists(cvPath))) {
    return { content: '', exists: false, path: 'cv.md' };
  }

  const content = await readFile(cvPath, 'utf-8');
  return { content, exists: true, path: 'cv.md' };
}

export async function writeCvFile(content) {
  await writeFile(cvPath, content, 'utf-8');
  return { content, path: 'cv.md' };
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

export async function readProfileInfo(options = {}) {
  const notes = [];
  const cvContent = typeof options.cvContent === 'string'
    ? options.cvContent
    : (await readCvFile()).content;
  const cvFallback = extractCvMetadata(cvContent);
  const hasProfile = await fileExists(profilePath);
  let source = 'fallback';
  let profileData = {};

  if (hasProfile) {
    try {
      profileData = parseYaml(await readFile(profilePath, 'utf-8')) || {};
      source = 'config/profile.yml';
    } catch (error) {
      notes.push(`Could not parse config/profile.yml: ${error.message}`);
    }
  }

  if (!hasProfile) {
    if (cvFallback.fullName || cvFallback.email || cvFallback.location) {
      source = 'cv.md';
      notes.push('config/profile.yml is missing; using header details from cv.md.');
    } else {
      notes.push('config/profile.yml is missing; using blank profile defaults.');
    }
  }

  const candidateConfig = profileData.candidate || {};
  const narrative = profileData.narrative || {};
  const targetRoles = profileData.target_roles || {};

  const fullName = firstNonEmpty(candidateConfig.full_name, cvFallback.fullName, 'Candidate');
  const email = firstNonEmpty(candidateConfig.email, cvFallback.email, '');
  const location = firstNonEmpty(candidateConfig.location, cvFallback.location, '');
  const linkedinRaw = firstNonEmpty(candidateConfig.linkedin, cvFallback.linkedin, '');
  const portfolioRaw = firstNonEmpty(candidateConfig.portfolio_url, cvFallback.portfolioUrl, '');

  return {
    hasProfile,
    source,
    notes,
    candidate: {
      fullName,
      email,
      location,
      linkedin: displayUrl(linkedinRaw),
      linkedinUrl: normalizeUrl(linkedinRaw),
      portfolioUrl: normalizeUrl(portfolioRaw),
      portfolioDisplay: displayUrl(portfolioRaw),
      github: firstNonEmpty(candidateConfig.github, cvFallback.github, ''),
      headline: firstNonEmpty(narrative.headline, ''),
      targetRoles: Array.isArray(targetRoles.primary)
        ? targetRoles.primary.filter((value) => typeof value === 'string' && value.trim())
        : [],
    },
  };
}

function extractCvMetadata(content) {
  const metadata = {
    fullName: '',
    email: '',
    location: '',
    linkedin: '',
    portfolioUrl: '',
    github: '',
  };

  if (!content) {
    return metadata;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const headingLine = lines.find((line) => /^#\s+/.test(line.trim()));
  if (headingLine) {
    const rawHeading = headingLine.replace(/^#\s+/, '').trim();
    metadata.fullName = rawHeading
      .replace(/^(cv|resume|curriculum vitae|jianli|resume summary|bio)\s*[-:]+\s*/i, '')
      .replace(/^简历\s*[-:]+\s*/u, '')
      .trim();
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+/.test(trimmed)) {
      break;
    }

    const match =
      trimmed.match(/^\*\*(.+?)[:：]\*\*\s*(.+)$/u) ||
      trimmed.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/u) ||
      trimmed.match(/^([^:#*][^:：]{1,30})\s*[:：]\s*(.+)$/u);

    if (!match) {
      continue;
    }

    const field = mapMetadataField(match[1]);
    if (!field) {
      continue;
    }

    metadata[field] = firstNonEmpty(metadata[field], match[2].trim(), '');
  }

  return metadata;
}

function mapMetadataField(label) {
  const normalized = label.toLowerCase().replace(/\s+/g, ' ').trim();

  if (normalized.includes('email') || normalized.includes('mail') || normalized.includes('邮箱')) {
    return 'email';
  }

  if (
    normalized.includes('location') ||
    normalized.includes('located') ||
    normalized.includes('所在地') ||
    normalized.includes('位置') ||
    normalized.includes('地址')
  ) {
    return 'location';
  }

  if (normalized.includes('linkedin') || normalized.includes('领英')) {
    return 'linkedin';
  }

  if (
    normalized.includes('portfolio') ||
    normalized.includes('website') ||
    normalized.includes('site') ||
    normalized.includes('作品集') ||
    normalized.includes('博客')
  ) {
    return 'portfolioUrl';
  }

  if (normalized.includes('github')) {
    return 'github';
  }

  return null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  const trimmed = value.trim();
  if (/^[a-z]+:\/\//i.test(trimmed) || trimmed.startsWith('mailto:')) {
    return trimmed;
  }

  if (trimmed.includes('@') && !trimmed.includes('/')) {
    return `mailto:${trimmed}`;
  }

  return `https://${trimmed.replace(/^\/\//, '')}`;
}

function displayUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/^mailto:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
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
      profile: raw.trim() ? (parseYaml(raw) ?? null) : null,
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