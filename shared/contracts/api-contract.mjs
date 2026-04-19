export const CONTRACT_VERSION = '2026-04-19';

export const CV_CONTENT_ALIASES = ['cvContent', 'cv', 'markdown'];
export const CV_REQUEST_FIELDS = ['content', ...CV_CONTENT_ALIASES];
export const CV_RESPONSE_PATHS = {
  exists: ['exists'],
  path: ['path'],
  content: [
    'content',
    'cvContent',
    'cv',
    'markdown',
  ],
};

export const PROFILE_RESPONSE_PATHS = {
  exists: ['exists', 'hasProfile', 'profile.hasProfile'],
  path: ['path'],
  profile: ['profile'],
  raw: ['raw'],
  source: ['source', 'profileSource', 'snapshot.source'],
  notes: ['notes', 'profileNotes', 'snapshot.notes'],
};

export const RESUME_REQUEST_FIELDS = {
  jobDescription: ['jobDescription'],
  company: ['company'],
  targetRole: ['targetRole'],
};

export const RESUME_RESULT_PATHS = {
  ok: ['ok'],
  artifactType: ['artifactType'],
  contentType: ['contentType'],
  language: ['language'],
  fileName: ['fileName'],
  downloadPath: ['downloadPath'],
  outputPath: ['outputPath'],
  previewMarkdown: ['previewMarkdown'],
  company: ['company'],
  targetRole: ['targetRole'],
  message: ['message'],
  keywords: ['keywords'],
  notes: ['notes'],
  sourceCvPath: ['sourceCvPath'],
  sourceProfilePath: ['sourceProfilePath'],
  generatedAt: ['generatedAt'],
};
export const ERROR_PAYLOAD_PATHS = {
  error: ['error', 'message'],
  details: ['details'],
};

export function buildCvRequest(content = '') {
  return {
    content: typeof content === 'string' ? content : '',
  };
}

export function normalizeCvRequest(payload = {}) {
  const match = findFirstStringAtPaths(payload, CV_REQUEST_FIELDS);

  return {
    content: match.value,
    provided: match.found,
  };
}

export function buildCvResponse({ exists = false, path = 'cv.md', content = '' } = {}) {
  return {
    exists: Boolean(exists),
    path: String(path || 'cv.md'),
    content: typeof content === 'string' ? content : '',
  };
}

export function normalizeCvResponse(payload = {}) {
  const content = pickFirstStringAtPaths(payload, CV_RESPONSE_PATHS.content);
  const path = pickFirstStringAtPaths(payload, CV_RESPONSE_PATHS.path, 'cv.md');
  const exists = pickFirstBooleanAtPaths(
    payload,
    CV_RESPONSE_PATHS.exists,
    Boolean(content || pickFirstStringAtPaths(payload, CV_RESPONSE_PATHS.path))
  );

  return {
    exists,
    path,
    content,
  };
}

export function buildProfileResponse({
  exists = false,
  path = '',
  profile = null,
  raw = '',
  source = '',
  notes = [],
} = {}) {
  const safeExists = Boolean(exists);
  const safePath = String(path || '');
  const safeSource = source || (safeExists ? safePath || 'profile' : 'missing');
  const snapshot = buildProfileSnapshotFromSources([{ profile, raw, path: safePath }, profile], {
    exists: safeExists,
    source: safeSource,
    notes,
  });

  return {
    exists: safeExists,
    path: safePath,
    profile: profile ?? null,
    raw: typeof raw === 'string' ? raw : '',
    snapshot,
    hasProfile: snapshot.hasProfile,
    source: snapshot.source,
    notes: snapshot.notes,
  };
}

export function normalizeProfileResponse(payload = {}) {
  const profile =
    pickFirstObjectAtPaths(payload, PROFILE_RESPONSE_PATHS.profile) ||
    (looksLikeProfileRecord(payload) ? payload : null);
  const raw = pickFirstStringAtPaths(payload, PROFILE_RESPONSE_PATHS.raw);
  const path = pickFirstStringAtPaths(payload, PROFILE_RESPONSE_PATHS.path, '');
  const notes = uniqueStrings(pickStringArrayAtPaths(payload, PROFILE_RESPONSE_PATHS.notes));
  const exists = pickFirstBooleanAtPaths(
    payload,
    PROFILE_RESPONSE_PATHS.exists,
    Boolean(profile || raw || pickFirstObjectAtPaths(payload, ['snapshot']))
  );
  const source = pickFirstStringAtPaths(
    payload,
    PROFILE_RESPONSE_PATHS.source,
    exists ? path || 'profile' : 'fallback'
  );
  const snapshot = buildProfileSnapshotFromSources([payload, profile], {
    exists,
    source,
    notes,
  });

  return {
    exists,
    path,
    profile,
    raw,
    snapshot,
    hasProfile: snapshot.hasProfile,
    source: snapshot.source,
    notes: snapshot.notes,
  };
}

export function buildResumeGenerateRequest({
  jobDescription = '',
  company = '',
  targetRole = '',
} = {}) {
  const payload = {
    jobDescription: typeof jobDescription === 'string' ? jobDescription.trim() : '',
  };
  const normalizedCompany = typeof company === 'string' ? company.trim() : '';
  const normalizedTargetRole = typeof targetRole === 'string' ? targetRole.trim() : '';

  if (normalizedCompany) {
    payload.company = normalizedCompany;
  }

  if (normalizedTargetRole) {
    payload.targetRole = normalizedTargetRole;
  }

  return payload;
}

export function normalizeResumeGenerateRequest(payload = {}) {
  return {
    jobDescription: pickFirstStringAtPaths(payload, RESUME_REQUEST_FIELDS.jobDescription).trim(),
    company: pickFirstStringAtPaths(payload, RESUME_REQUEST_FIELDS.company).trim(),
    targetRole: pickFirstStringAtPaths(payload, RESUME_REQUEST_FIELDS.targetRole).trim(),
  };
}

export function buildResumeResult({
  ok = true,
  artifactType = 'markdown',
  contentType = 'text/markdown; charset=utf-8',
  language = 'en',
  fileName = '',
  downloadPath = '',
  outputPath = '',
  previewMarkdown = '',
  company = '',
  targetRole = '',
  message = '',
  keywords = [],
  notes = [],
  sourceCvPath = '',
  sourceProfilePath = null,
  generatedAt = '',
} = {}) {
  const normalizedFileName = basename(fileName);
  const normalizedDownloadPath = String(downloadPath || '');
  const normalizedPreviewMarkdown = typeof previewMarkdown === 'string' ? previewMarkdown : '';
  const normalizedCompany = typeof company === 'string' ? company.trim() : '';
  const normalizedTargetRole = typeof targetRole === 'string' ? targetRole.trim() : '';
  const normalizedKeywords = uniqueStrings(coerceStringArray(keywords));
  const normalizedNotes = uniqueStrings(coerceStringArray(notes));
  const normalizedMessage =
    (typeof message === 'string' ? message.trim() : '') ||
    buildResumeMessage({
      company: normalizedCompany,
      targetRole: normalizedTargetRole,
      previewMarkdown: normalizedPreviewMarkdown,
      fileName: normalizedFileName,
    });

  return {
    ok: Boolean(ok),
    artifactType,
    contentType,
    language,
    fileName: normalizedFileName,
    downloadPath: normalizedDownloadPath,
    outputPath: typeof outputPath === 'string' ? outputPath : '',
    previewMarkdown: normalizedPreviewMarkdown,
    company: normalizedCompany,
    targetRole: normalizedTargetRole,
    message: normalizedMessage,
    keywords: normalizedKeywords,
    notes: normalizedNotes,
    sourceCvPath: typeof sourceCvPath === 'string' ? sourceCvPath : '',
    sourceProfilePath:
      typeof sourceProfilePath === 'string' && sourceProfilePath.trim()
        ? sourceProfilePath
        : null,
    generatedAt: typeof generatedAt === 'string' ? generatedAt : '',
  };
}

export function normalizeResumeResult(payload = {}) {
  const fileName = basename(pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.fileName));
  const previewMarkdown = pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.previewMarkdown);
  const company = pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.company);
  const targetRole = pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.targetRole);
  const downloadPath = pickFirstStringAtPaths(
    payload,
    RESUME_RESULT_PATHS.downloadPath,
    fileName ? `/api/resume/download/${encodeURIComponent(fileName)}` : ''
  );
  const outputPath = pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.outputPath);
  const language = pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.language, 'en');
  const generatedAt = pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.generatedAt);
  const keywords = uniqueStrings(pickStringArrayAtPaths(payload, RESUME_RESULT_PATHS.keywords));
  const notes = uniqueStrings(pickStringArrayAtPaths(payload, RESUME_RESULT_PATHS.notes));
  const sourceProfilePath = pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.sourceProfilePath);

  return {
    ok: pickFirstBooleanAtPaths(payload, RESUME_RESULT_PATHS.ok, true),
    artifactType: pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.artifactType, 'markdown'),
    contentType: pickFirstStringAtPaths(
      payload,
      RESUME_RESULT_PATHS.contentType,
      'text/markdown; charset=utf-8'
    ),
    language,
    fileName,
    downloadPath,
    outputPath,
    previewMarkdown,
    company,
    targetRole,
    message: pickFirstStringAtPaths(
      payload,
      RESUME_RESULT_PATHS.message,
      buildResumeMessage({ company, targetRole, previewMarkdown, fileName })
    ),
    keywords,
    notes,
    sourceCvPath: pickFirstStringAtPaths(payload, RESUME_RESULT_PATHS.sourceCvPath),
    sourceProfilePath: sourceProfilePath || null,
    generatedAt,
  };
}

export function buildErrorPayload(error, details) {
  const payload = {
    error: typeof error === 'string' && error.trim() ? error.trim() : 'Request failed',
  };

  if (details !== undefined) {
    payload.details = details;
  }

  return payload;
}

export function normalizeErrorPayload(payload = {}, fallback = 'Request failed') {
  return {
    error: pickFirstStringAtPaths(payload, ERROR_PAYLOAD_PATHS.error, fallback),
    details: pickFirstValueAtPaths(payload, ERROR_PAYLOAD_PATHS.details),
  };
}

function buildProfileSnapshotFromSources(sources, {
  exists = false,
  source = 'fallback',
  notes = [],
} = {}) {
  const linkedinUrl = normalizeUrl(
    pickFirstStringFromSources(sources, [
      'snapshot.linkedinUrl',
      'snapshot.linkedin_url',
      'candidate.linkedinUrl',
      'candidate.linkedin_url',
      'candidate.linkedin',
      'profile.candidate.linkedinUrl',
      'profile.candidate.linkedin_url',
      'profile.candidate.linkedin',
      'linkedinUrl',
      'linkedin_url',
      'linkedin',
    ])
  );
  const portfolioUrl = normalizeUrl(
    pickFirstStringFromSources(sources, [
      'snapshot.portfolioUrl',
      'snapshot.portfolio_url',
      'candidate.portfolioUrl',
      'candidate.portfolio_url',
      'candidate.website',
      'candidate.portfolio',
      'profile.candidate.portfolioUrl',
      'profile.candidate.portfolio_url',
      'profile.candidate.website',
      'portfolioUrl',
      'portfolio_url',
      'website',
      'portfolio',
    ])
  );
  const location =
    pickFirstStringFromSources(sources, [
      'snapshot.location',
      'candidate.location',
      'profile.candidate.location',
      'locationLabel',
      'location',
    ]) ||
    formatLocationValue(
      pickFirstValueFromSources(sources, [
        'candidate.location',
        'profile.candidate.location',
        'location',
        'profile.location',
      ])
    );
  const targetRoles = uniqueStrings([
    ...pickStringArrayFromSources(sources, [
      'snapshot.targetRoles',
      'candidate.targetRoles',
      'candidate.target_roles.primary',
      'profile.candidate.targetRoles',
      'profile.candidate.target_roles.primary',
      'target_roles.primary',
      'primaryRoles',
    ]),
    pickFirstStringFromSources(sources, ['snapshot.targetRole', 'targetRole', 'role']),
  ]);
  const snapshotNotes = uniqueStrings([
    ...pickStringArrayFromSources(sources, ['snapshot.notes']),
    ...coerceStringArray(notes),
  ]);
  const hasProfile = pickFirstBooleanFromSources(sources, ['snapshot.hasProfile'], Boolean(exists));

  return {
    name: pickFirstStringFromSources(
      sources,
      [
        'snapshot.name',
        'snapshot.fullName',
        'snapshot.full_name',
        'candidate.fullName',
        'candidate.full_name',
        'candidate.name',
        'candidate.displayName',
        'profile.candidate.fullName',
        'profile.candidate.full_name',
        'profile.candidate.name',
        'fullName',
        'full_name',
        'name',
        'displayName',
      ],
      hasProfile ? 'Profile loaded' : 'Profile unavailable'
    ),
    headline: pickFirstStringFromSources(sources, [
      'snapshot.headline',
      'candidate.headline',
      'candidate.summary',
      'narrative.headline',
      'profile.headline',
      'headline',
      'summary',
    ]),
    email: pickFirstStringFromSources(sources, [
      'snapshot.email',
      'candidate.email',
      'profile.candidate.email',
      'email',
    ]),
    location,
    linkedinLabel: pickFirstStringFromSources(
      sources,
      [
        'snapshot.linkedinLabel',
        'snapshot.linkedin',
        'candidate.linkedin',
        'candidate.linkedinDisplay',
        'candidate.linkedin_display',
        'profile.candidate.linkedin',
        'profile.candidate.linkedinDisplay',
        'linkedinDisplay',
        'linkedin_display',
      ],
      displayUrl(linkedinUrl)
    ),
    linkedinUrl,
    portfolioLabel: pickFirstStringFromSources(
      sources,
      [
        'snapshot.portfolioLabel',
        'snapshot.portfolio',
        'candidate.portfolioDisplay',
        'candidate.portfolio_display',
        'candidate.portfolio',
        'profile.candidate.portfolioDisplay',
        'profile.candidate.portfolio_display',
        'portfolioDisplay',
        'portfolio_display',
      ],
      displayUrl(portfolioUrl)
    ),
    portfolioUrl,
    github: pickFirstStringFromSources(sources, [
      'snapshot.github',
      'candidate.github',
      'profile.candidate.github',
      'github',
    ]),
    targetRoles,
    hasProfile,
    source: pickFirstStringFromSources(sources, ['snapshot.source'], source || 'fallback'),
    notes: snapshotNotes,
  };
}

function buildResumeMessage({ company = '', targetRole = '', previewMarkdown = '', fileName = '' }) {
  const targetLabel = [company, targetRole].filter(Boolean).join(' - ');

  if (targetLabel) {
    return `Tailored Markdown resume ready for ${targetLabel}.`;
  }

  if (previewMarkdown) {
    return 'Tailored Markdown resume generated successfully.';
  }

  if (fileName) {
    return `Generated ${fileName}.`;
  }

  return 'Resume generation completed.';
}

function pickFirstStringFromSources(sources, paths, fallback = '') {
  for (const source of sources) {
    const value = pickFirstStringAtPaths(source, paths);

    if (value) {
      return value;
    }
  }

  return fallback;
}

function pickFirstValueFromSources(sources, paths) {
  for (const source of sources) {
    const value = pickFirstValueAtPaths(source, paths);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function pickFirstBooleanFromSources(sources, paths, fallback = false) {
  for (const source of sources) {
    const value = pickFirstBooleanAtPaths(source, paths, fallback);

    if (value !== fallback) {
      return value;
    }
  }

  return fallback;
}

function pickStringArrayFromSources(sources, paths) {
  const values = [];

  for (const source of sources) {
    values.push(...pickStringArrayAtPaths(source, paths));
  }

  return values;
}

function pickFirstStringAtPaths(source, paths, fallback = '') {
  return findFirstStringAtPaths(source, paths).value || fallback;
}

function findFirstStringAtPaths(source, paths) {
  for (const path of paths) {
    const value = getValueAtPath(source, path);

    if (typeof value === 'string') {
      return {
        value,
        found: true,
      };
    }
  }

  return {
    value: '',
    found: false,
  };
}

function pickFirstBooleanAtPaths(source, paths, fallback = false) {
  for (const path of paths) {
    const value = getValueAtPath(source, path);

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return fallback;
}

function pickStringArrayAtPaths(source, paths) {
  const values = [];

  for (const path of paths) {
    values.push(...coerceStringArray(getValueAtPath(source, path)));
  }

  return values;
}

function pickFirstObjectAtPaths(source, paths) {
  for (const path of paths) {
    const value = getValueAtPath(source, path);
    const record = asRecord(value);

    if (record) {
      return record;
    }
  }

  return null;
}

function pickFirstValueAtPaths(source, paths) {
  for (const path of paths) {
    const value = getValueAtPath(source, path);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function getValueAtPath(source, path) {
  if (!path) {
    return source;
  }

  const segments = String(path).split('.').filter(Boolean);
  let current = source;

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }

    const record = asRecord(current);

    if (!record || !(segment in record)) {
      return undefined;
    }

    current = record[segment];
  }

  return current;
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    result.push(normalizedValue);
  }

  return result;
}

function coerceStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeUrl(value) {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';

  if (!normalizedValue) {
    return '';
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(normalizedValue) || normalizedValue.startsWith('mailto:')) {
    return normalizedValue;
  }

  if (normalizedValue.includes('@') && !normalizedValue.includes('/')) {
    return `mailto:${normalizedValue}`;
  }

  return `https://${normalizedValue.replace(/^\/\//, '')}`;
}

function displayUrl(value) {
  if (!value) {
    return '';
  }

  return value
    .replace(/^mailto:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

function formatLocationValue(value) {
  if (typeof value === 'string') {
    return value.trim();
  }

  const record = asRecord(value);

  if (!record) {
    return '';
  }

  return uniqueStrings([
    typeof record.city === 'string' ? record.city : '',
    typeof record.state === 'string' ? record.state : '',
    typeof record.country === 'string' ? record.country : '',
  ]).join(', ');
}

function basename(value) {
  return String(value || '')
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() || '';
}

function looksLikeProfileRecord(value) {
  const record = asRecord(value);

  if (!record) {
    return false;
  }

  return Boolean(record.candidate || record.target_roles || record.narrative || record.compensation);
}
