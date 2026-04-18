export const CONTRACT_VERSION = "2026-04-19";

export interface ContractCvResponse {
  exists: boolean;
  path: string;
  content: string;
}

export interface ContractProfileSnapshot {
  name: string;
  headline: string;
  email: string;
  location: string;
  linkedinLabel: string;
  linkedinUrl: string;
  portfolioLabel: string;
  portfolioUrl: string;
  github: string;
  targetRoles: string[];
  hasProfile: boolean;
  source: string;
  notes: string[];
}

export interface ContractProfileResponse {
  exists: boolean;
  path: string;
  profile: Record<string, unknown> | null;
  raw: string;
  snapshot: ContractProfileSnapshot;
  hasProfile: boolean;
  source: string;
  notes: string[];
}

export interface ContractResumeGenerateRequest {
  jobDescription: string;
  company?: string;
  targetRole?: string;
}

export interface ContractResumeResult {
  ok: boolean;
  artifactType: string;
  contentType: string;
  language: string;
  fileName: string;
  downloadPath: string;
  outputPath: string;
  previewMarkdown: string;
  company: string;
  targetRole: string;
  message: string;
  keywords: string[];
  notes: string[];
  sourceCvPath: string;
  sourceProfilePath: string | null;
  generatedAt: string;
}

export interface ContractErrorPayload {
  error: string;
  details?: unknown;
}

const CV_RESPONSE_CONTENT_PATHS = [
  "content",
  "cvContent",
  "cv",
  "markdown",
  "data.content",
  "data.cvContent",
  "data.cv",
  "data.markdown",
  "result.content",
  "result.cvContent",
  "result.cv",
  "result.markdown",
];

const PROFILE_SNAPSHOT_NAME_PATHS = [
  "snapshot.name",
  "snapshot.fullName",
  "snapshot.full_name",
  "candidate.fullName",
  "candidate.full_name",
  "candidate.name",
  "candidate.displayName",
  "profile.candidate.fullName",
  "profile.candidate.full_name",
  "profile.candidate.name",
  "fullName",
  "full_name",
  "name",
  "displayName",
];

const PROFILE_SNAPSHOT_HEADLINE_PATHS = [
  "snapshot.headline",
  "candidate.headline",
  "candidate.summary",
  "narrative.headline",
  "profile.headline",
  "headline",
  "summary",
];

const PROFILE_SNAPSHOT_EMAIL_PATHS = [
  "snapshot.email",
  "candidate.email",
  "profile.candidate.email",
  "email",
];

const PROFILE_SNAPSHOT_LINKEDIN_URL_PATHS = [
  "snapshot.linkedinUrl",
  "snapshot.linkedin_url",
  "candidate.linkedinUrl",
  "candidate.linkedin_url",
  "candidate.linkedin",
  "profile.candidate.linkedinUrl",
  "profile.candidate.linkedin_url",
  "profile.candidate.linkedin",
  "linkedinUrl",
  "linkedin_url",
  "linkedin",
];

const PROFILE_SNAPSHOT_LINKEDIN_LABEL_PATHS = [
  "snapshot.linkedinLabel",
  "snapshot.linkedin",
  "candidate.linkedin",
  "candidate.linkedinDisplay",
  "candidate.linkedin_display",
  "profile.candidate.linkedin",
  "profile.candidate.linkedinDisplay",
  "linkedinDisplay",
  "linkedin_display",
];

const PROFILE_SNAPSHOT_PORTFOLIO_URL_PATHS = [
  "snapshot.portfolioUrl",
  "snapshot.portfolio_url",
  "candidate.portfolioUrl",
  "candidate.portfolio_url",
  "candidate.website",
  "candidate.portfolio",
  "profile.candidate.portfolioUrl",
  "profile.candidate.portfolio_url",
  "profile.candidate.website",
  "portfolioUrl",
  "portfolio_url",
  "website",
  "portfolio",
];

const PROFILE_SNAPSHOT_PORTFOLIO_LABEL_PATHS = [
  "snapshot.portfolioLabel",
  "snapshot.portfolio",
  "candidate.portfolioDisplay",
  "candidate.portfolio_display",
  "candidate.portfolio",
  "profile.candidate.portfolioDisplay",
  "profile.candidate.portfolio_display",
  "portfolioDisplay",
  "portfolio_display",
];

const PROFILE_SNAPSHOT_GITHUB_PATHS = [
  "snapshot.github",
  "candidate.github",
  "profile.candidate.github",
  "github",
];

const PROFILE_SNAPSHOT_LOCATION_PATHS = [
  "snapshot.location",
  "candidate.location",
  "profile.candidate.location",
  "locationLabel",
  "location",
];

const PROFILE_SNAPSHOT_TARGET_ROLE_PATHS = [
  "snapshot.targetRole",
  "targetRole",
  "role",
];

const PROFILE_SNAPSHOT_TARGET_ROLE_ARRAY_PATHS = [
  "snapshot.targetRoles",
  "candidate.targetRoles",
  "candidate.target_roles.primary",
  "profile.candidate.targetRoles",
  "profile.candidate.target_roles.primary",
  "target_roles.primary",
  "primaryRoles",
];

const PROFILE_SNAPSHOT_NOTES_PATHS = [
  "snapshot.notes",
  "notes",
  "profileNotes",
  "data.notes",
  "result.notes",
];

const RESUME_RESULT_FILE_NAME_PATHS = [
  "fileName",
  "data.fileName",
  "result.fileName",
];

const RESUME_RESULT_PREVIEW_PATHS = [
  "previewMarkdown",
  "result.previewMarkdown",
  "data.previewMarkdown",
];

const RESUME_RESULT_COMPANY_PATHS = [
  "company",
  "data.company",
  "result.company",
];

const RESUME_RESULT_TARGET_ROLE_PATHS = [
  "targetRole",
  "data.targetRole",
  "result.targetRole",
];

const RESUME_RESULT_MESSAGE_PATHS = [
  "message",
  "data.message",
  "result.message",
];

const RESUME_RESULT_DOWNLOAD_PATHS = [
  "downloadPath",
  "data.downloadPath",
  "result.downloadPath",
];

const RESUME_RESULT_KEYWORDS_PATHS = [
  "keywords",
  "data.keywords",
  "result.keywords",
];

const RESUME_RESULT_NOTES_PATHS = ["notes", "data.notes", "result.notes"];

const RESUME_RESULT_SOURCE_CV_PATHS = [
  "sourceCvPath",
  "data.sourceCvPath",
  "result.sourceCvPath",
];

const RESUME_RESULT_SOURCE_PROFILE_PATHS = [
  "sourceProfilePath",
  "data.sourceProfilePath",
  "result.sourceProfilePath",
];

const RESUME_RESULT_GENERATED_AT_PATHS = [
  "generatedAt",
  "data.generatedAt",
  "result.generatedAt",
];

const ERROR_MESSAGE_PATHS = ["error", "message", "data.error", "data.message"];

const ERROR_DETAILS_PATHS = ["details", "data.details", "result.details"];

export function buildCvRequest(content = ""): {
  content: string;
} {
  return {
    content,
  };
}

export function normalizeCvResponse(payload: unknown): ContractCvResponse {
  const content = pickFirstString(payload, CV_RESPONSE_CONTENT_PATHS);
  const path = pickFirstString(
    payload,
    ["path", "data.path", "result.path"],
    "cv.md"
  );
  const exists = pickFirstBoolean(
    payload,
    ["exists", "data.exists", "result.exists"],
    Boolean(
      content || pickFirstString(payload, ["path", "data.path", "result.path"])
    )
  );

  return {
    exists,
    path,
    content,
  };
}

export function normalizeProfileResponse(
  payload: unknown
): ContractProfileResponse {
  const profile =
    pickFirstRecord(payload, ["profile", "data.profile", "result.profile"]) ||
    (looksLikeProfileRecord(payload) ? asRecord(payload) : null);
  const raw = pickFirstString(payload, ["raw", "data.raw", "result.raw"]);
  const path = pickFirstString(payload, ["path", "data.path", "result.path"]);
  const notes = uniqueStrings(
    stringArrayFromPaths(payload, PROFILE_SNAPSHOT_NOTES_PATHS)
  );
  const exists = pickFirstBoolean(
    payload,
    [
      "exists",
      "data.exists",
      "result.exists",
      "hasProfile",
      "profile.hasProfile",
    ],
    Boolean(profile || raw || getNestedValue(payload, "snapshot"))
  );
  const source = pickFirstString(
    payload,
    [
      "source",
      "profileSource",
      "snapshot.source",
      "data.source",
      "result.source",
    ],
    exists ? path || "profile" : "fallback"
  );
  const snapshot = normalizeProfileSnapshot(payload, {
    exists,
    source,
    notes,
    profile,
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

export function buildResumeGenerateRequest(
  request: ContractResumeGenerateRequest
): Record<string, string> {
  const payload: Record<string, string> = {
    jobDescription:
      typeof request.jobDescription === "string"
        ? request.jobDescription.trim()
        : "",
  };
  const company =
    typeof request.company === "string" ? request.company.trim() : "";
  const targetRole =
    typeof request.targetRole === "string" ? request.targetRole.trim() : "";

  if (company) {
    payload.company = company;
  }

  if (targetRole) {
    payload.targetRole = targetRole;
  }

  return payload;
}

export function normalizeResumeGenerateRequest(
  payload: unknown
): ContractResumeGenerateRequest {
  const jobDescription = pickFirstString(payload, ["jobDescription"]).trim();
  const company = pickFirstString(payload, ["company"]).trim();
  const targetRole = pickFirstString(payload, ["targetRole"]).trim();

  return {
    jobDescription,
    company: company || undefined,
    targetRole: targetRole || undefined,
  };
}

export function normalizeResumeResult(payload: unknown): ContractResumeResult {
  const fileName = basename(
    pickFirstString(payload, RESUME_RESULT_FILE_NAME_PATHS)
  );
  const previewMarkdown = pickFirstString(payload, RESUME_RESULT_PREVIEW_PATHS);
  const company = pickFirstString(payload, RESUME_RESULT_COMPANY_PATHS);
  const targetRole = pickFirstString(payload, RESUME_RESULT_TARGET_ROLE_PATHS);
  const message = pickFirstString(
    payload,
    RESUME_RESULT_MESSAGE_PATHS,
    buildResumeMessage(company, targetRole, previewMarkdown, fileName)
  );
  const downloadPath = pickFirstString(
    payload,
    RESUME_RESULT_DOWNLOAD_PATHS,
    fileName ? `/api/resume/download/${encodeURIComponent(fileName)}` : ""
  );

  return {
    ok: pickFirstBoolean(payload, ["ok", "data.ok", "result.ok"], true),
    artifactType: pickFirstString(
      payload,
      ["artifactType", "data.artifactType", "result.artifactType"],
      "markdown"
    ),
    contentType: pickFirstString(
      payload,
      ["contentType", "data.contentType", "result.contentType"],
      "text/markdown; charset=utf-8"
    ),
    language: pickFirstString(
      payload,
      ["language", "data.language", "result.language"],
      "en"
    ),
    fileName,
    downloadPath,
    outputPath: pickFirstString(payload, [
      "outputPath",
      "data.outputPath",
      "result.outputPath",
    ]),
    previewMarkdown,
    company,
    targetRole,
    message,
    keywords: uniqueStrings(
      stringArrayFromPaths(payload, RESUME_RESULT_KEYWORDS_PATHS)
    ),
    notes: uniqueStrings(
      stringArrayFromPaths(payload, RESUME_RESULT_NOTES_PATHS)
    ),
    sourceCvPath: pickFirstString(payload, RESUME_RESULT_SOURCE_CV_PATHS),
    sourceProfilePath:
      pickFirstString(payload, RESUME_RESULT_SOURCE_PROFILE_PATHS) || null,
    generatedAt: pickFirstString(payload, RESUME_RESULT_GENERATED_AT_PATHS),
  };
}

export function buildErrorPayload(
  error = "Request failed",
  details?: unknown
): ContractErrorPayload {
  return details === undefined ? { error } : { error, details };
}

export function normalizeErrorPayload(
  payload: unknown,
  fallback = "Request failed"
): ContractErrorPayload {
  const error = pickFirstString(payload, ERROR_MESSAGE_PATHS, fallback);
  const details = pickFirstValue(payload, ERROR_DETAILS_PATHS);

  return details === undefined ? { error } : { error, details };
}

function normalizeProfileSnapshot(
  payload: unknown,
  options: {
    exists: boolean;
    source: string;
    notes: string[];
    profile: Record<string, unknown> | null;
  }
): ContractProfileSnapshot {
  const sources = [payload, options.profile].filter(Boolean);
  const linkedinUrl = normalizeUrl(
    pickFirstStringFromSources(sources, PROFILE_SNAPSHOT_LINKEDIN_URL_PATHS)
  );
  const portfolioUrl = normalizeUrl(
    pickFirstStringFromSources(sources, PROFILE_SNAPSHOT_PORTFOLIO_URL_PATHS)
  );
  const location =
    pickFirstStringFromSources(sources, PROFILE_SNAPSHOT_LOCATION_PATHS) ||
    formatLocationValue(
      pickFirstValueFromSources(sources, [
        "candidate.location",
        "profile.candidate.location",
        "location",
        "profile.location",
      ])
    );
  const targetRoles = uniqueStrings([
    ...stringArrayFromSources(
      sources,
      PROFILE_SNAPSHOT_TARGET_ROLE_ARRAY_PATHS
    ),
    pickFirstStringFromSources(sources, PROFILE_SNAPSHOT_TARGET_ROLE_PATHS),
  ]);
  const notes = uniqueStrings([
    ...stringArrayFromSources(sources, PROFILE_SNAPSHOT_NOTES_PATHS),
    ...options.notes,
  ]);

  return {
    name: pickFirstStringFromSources(
      sources,
      PROFILE_SNAPSHOT_NAME_PATHS,
      options.exists ? "Profile loaded" : "Profile unavailable"
    ),
    headline: pickFirstStringFromSources(
      sources,
      PROFILE_SNAPSHOT_HEADLINE_PATHS
    ),
    email: pickFirstStringFromSources(sources, PROFILE_SNAPSHOT_EMAIL_PATHS),
    location,
    linkedinLabel: pickFirstStringFromSources(
      sources,
      PROFILE_SNAPSHOT_LINKEDIN_LABEL_PATHS,
      displayUrl(linkedinUrl)
    ),
    linkedinUrl,
    portfolioLabel: pickFirstStringFromSources(
      sources,
      PROFILE_SNAPSHOT_PORTFOLIO_LABEL_PATHS,
      displayUrl(portfolioUrl)
    ),
    portfolioUrl,
    github: pickFirstStringFromSources(sources, PROFILE_SNAPSHOT_GITHUB_PATHS),
    targetRoles,
    hasProfile: options.exists,
    source: pickFirstStringFromSources(
      sources,
      ["snapshot.source"],
      options.source || "fallback"
    ),
    notes,
  };
}

function buildResumeMessage(
  company: string,
  targetRole: string,
  previewMarkdown: string,
  fileName: string
): string {
  const targetLabel = [company, targetRole].filter(Boolean).join(" - ");

  if (targetLabel) {
    return `Tailored Markdown resume ready for ${targetLabel}.`;
  }

  if (previewMarkdown) {
    return "Tailored Markdown resume generated successfully.";
  }

  if (fileName) {
    return `Generated ${fileName}.`;
  }

  return "Resume generation completed.";
}

function pickFirstStringFromSources(
  sources: unknown[],
  paths: string[],
  fallback = ""
): string {
  for (const source of sources) {
    const value = pickFirstString(source, paths);

    if (value) {
      return value;
    }
  }

  return fallback;
}

function pickFirstValueFromSources(
  sources: unknown[],
  paths: string[]
): unknown {
  for (const source of sources) {
    const value = pickFirstValue(source, paths);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function stringArrayFromSources(sources: unknown[], paths: string[]): string[] {
  const values: string[] = [];

  for (const source of sources) {
    values.push(...stringArrayFromPaths(source, paths));
  }

  return values;
}

function stringArrayFromPaths(source: unknown, paths: string[]): string[] {
  const values: string[] = [];

  for (const path of paths) {
    values.push(...coerceStringArray(getNestedValue(source, path)));
  }

  return values;
}

function pickFirstString(
  source: unknown,
  paths: string[],
  fallback = ""
): string {
  for (const path of paths) {
    const value = getNestedValue(source, path);

    if (typeof value === "string") {
      return value;
    }
  }

  return fallback;
}

function pickFirstBoolean(
  source: unknown,
  paths: string[],
  fallback: boolean
): boolean {
  for (const path of paths) {
    const value = getNestedValue(source, path);

    if (typeof value === "boolean") {
      return value;
    }
  }

  return fallback;
}

function pickFirstRecord(
  source: unknown,
  paths: string[]
): Record<string, unknown> | null {
  for (const path of paths) {
    const record = asRecord(getNestedValue(source, path));

    if (record) {
      return record;
    }
  }

  return null;
}

function pickFirstValue(source: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = getNestedValue(source, path);

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function getNestedValue(source: unknown, path: string): unknown {
  if (!path) {
    return source;
  }

  const segments = path.split(".").filter(Boolean);
  let current: unknown = source;

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    result.push(normalizedValue);
  }

  return result;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeUrl(value: string): string {
  if (!value.trim()) {
    return "";
  }

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) || value.startsWith("mailto:")) {
    return value;
  }

  if (value.includes("@") && !value.includes("/")) {
    return `mailto:${value}`;
  }

  return `https://${value.replace(/^\/\//, "")}`;
}

function displayUrl(value: string): string {
  return value
    .replace(/^mailto:/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");
}

function formatLocationValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  const record = asRecord(value);
  if (!record) {
    return "";
  }

  return uniqueStrings([
    typeof record.city === "string" ? record.city : "",
    typeof record.state === "string" ? record.state : "",
    typeof record.country === "string" ? record.country : "",
  ]).join(", ");
}

function basename(value: string): string {
  return (
    String(value || "")
      .split(/[\\/]/)
      .filter(Boolean)
      .pop() || ""
  );
}

function looksLikeProfileRecord(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) {
    return false;
  }

  return Boolean(
    record.candidate ||
      record.target_roles ||
      record.narrative ||
      record.compensation
  );
}
