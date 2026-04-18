export interface CvDocument {
  content: string;
  path: string;
}

export interface MetadataEntry {
  label: string;
  value: string;
}

export interface LinkEntry {
  key: string;
  label: string;
  href: string;
}

export interface ProfileSnapshot {
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

export interface ResumeResult {
  previewMarkdown: string;
  fileName: string;
  company: string;
  role: string;
  message: string;
  metadata: MetadataEntry[];
  links: LinkEntry[];
  notes: string[];
}

export interface ApiError extends Error {
  status?: number;
  payload?: unknown;
}

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;
const FILE_LIKE_PATTERN = /\.[a-z\d]{1,8}(?:[?#].*)?$/i;
const HUMANIZED_LABELS: Record<string, string> = {
  companyName: "Company",
  fileName: "File name",
  filename: "File name",
  generatedAt: "Generated at",
  keywordCoverage: "Keyword coverage",
  targetRole: "Role",
};

export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787/api";

export function getApiBaseUrl(): string {
  const rawValue =
    typeof import.meta.env.VITE_API_BASE_URL === "string"
      ? import.meta.env.VITE_API_BASE_URL
      : "";

  return normalizeApiBaseUrl(rawValue || DEFAULT_API_BASE_URL);
}

export function resolveApiUrl(path: string): string {
  const apiBaseUrl = toApiBaseUrl();
  const cleanPath = String(path || "").replace(/^\/+/, "");
  return new URL(cleanPath, apiBaseUrl).toString();
}

export async function fetchJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(resolveApiUrl(path), init);
  const text = await response.text();
  const payload = text ? safeJsonParse(text) : {};

  if (!response.ok) {
    const error = new Error(
      getPayloadMessage(payload, response.status)
    ) as ApiError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return (payload && typeof payload === "object" ? payload : {}) as T;
}

export function extractCvDocument(payload: unknown): CvDocument {
  return {
    content: firstNonEmptyString(payload, [
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
    ]),
    path: firstNonEmptyString(
      payload,
      ["path", "data.path", "result.path"],
      "cv.md"
    ),
  };
}

export function extractProfileSnapshot(payload: unknown): ProfileSnapshot {
  const linkedinUrl = normalizeUrl(
    firstNonEmptyString(payload, [
      "candidate.linkedinUrl",
      "candidate.linkedin_url",
      "candidate.linkedin",
      "profile.candidate.linkedinUrl",
      "profile.candidate.linkedin_url",
      "profile.candidate.linkedin",
      "linkedinUrl",
      "linkedin_url",
      "linkedin",
    ])
  );
  const portfolioUrl = normalizeUrl(
    firstNonEmptyString(payload, [
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
    ])
  );

  const location =
    firstNonEmptyString(payload, [
      "candidate.location",
      "profile.candidate.location",
      "locationLabel",
      "location",
    ]) || formatLocationValue(getNestedValue(payload, "location"));

  return {
    name: firstNonEmptyString(
      payload,
      [
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
      ],
      "Profile loaded"
    ),
    headline: firstNonEmptyString(payload, [
      "candidate.headline",
      "candidate.summary",
      "narrative.headline",
      "profile.headline",
      "headline",
      "summary",
    ]),
    email: firstNonEmptyString(payload, [
      "candidate.email",
      "profile.candidate.email",
      "email",
    ]),
    location,
    linkedinLabel: firstNonEmptyString(
      payload,
      [
        "candidate.linkedin",
        "candidate.linkedinDisplay",
        "candidate.linkedin_display",
        "profile.candidate.linkedin",
        "profile.candidate.linkedinDisplay",
        "linkedinDisplay",
        "linkedin_display",
      ],
      displayUrl(linkedinUrl)
    ),
    linkedinUrl,
    portfolioLabel: firstNonEmptyString(
      payload,
      [
        "candidate.portfolioDisplay",
        "candidate.portfolio_display",
        "candidate.portfolio",
        "profile.candidate.portfolioDisplay",
        "profile.candidate.portfolio_display",
        "portfolioDisplay",
        "portfolio_display",
      ],
      displayUrl(portfolioUrl)
    ),
    portfolioUrl,
    github: firstNonEmptyString(payload, [
      "candidate.github",
      "profile.candidate.github",
      "github",
    ]),
    targetRoles: uniqueStrings([
      ...stringArrayFromPaths(payload, [
        "candidate.targetRoles",
        "candidate.target_roles.primary",
        "profile.candidate.targetRoles",
        "profile.candidate.target_roles.primary",
        "target_roles.primary",
        "primaryRoles",
      ]),
      firstNonEmptyString(payload, ["role", "targetRole"]),
    ]),
    hasProfile: firstBoolean(
      payload,
      ["hasProfile", "profile.hasProfile"],
      false
    ),
    source: firstNonEmptyString(
      payload,
      ["source", "profileSource"],
      "fallback"
    ),
    notes: uniqueStrings([
      ...stringArrayFromPaths(payload, ["notes", "profileNotes"]),
    ]),
  };
}

export function extractResumeResult(payload: unknown): ResumeResult {
  const fileName = basename(
    firstNonEmptyString(payload, [
      "fileName",
      "filename",
      "name",
      "data.fileName",
      "data.filename",
      "result.fileName",
      "result.filename",
      "resume.fileName",
      "resume.filename",
      "output.fileName",
      "output.filename",
    ])
  );

  return {
    previewMarkdown: firstNonEmptyString(payload, [
      "content",
      "markdown",
      "resumeMarkdown",
      "resume.markdown",
      "resume.content",
      "result.markdown",
      "result.content",
      "data.markdown",
      "data.content",
      "generated.markdown",
      "generated.content",
      "output.markdown",
      "output.content",
    ]),
    fileName,
    company: firstNonEmptyString(payload, [
      "company",
      "companyName",
      "data.company",
      "data.companyName",
      "result.company",
      "result.companyName",
    ]),
    role: firstNonEmptyString(payload, [
      "role",
      "targetRole",
      "data.role",
      "data.targetRole",
      "result.role",
      "result.targetRole",
    ]),
    message: firstNonEmptyString(payload, [
      "message",
      "statusMessage",
      "data.message",
      "result.message",
    ]),
    metadata: collectMetadata(payload, fileName),
    links: collectLinks(payload, fileName),
    notes: uniqueStrings([
      ...stringArrayFromPaths(payload, [
        "notes",
        "data.notes",
        "result.notes",
        "metadata.notes",
      ]),
    ]),
  };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function collectMetadata(payload: unknown, fileName: string): MetadataEntry[] {
  const entries: MetadataEntry[] = [];
  const seen = new Set<string>();
  const fields: Array<[string, string[]]> = [
    ["company", ["company", "companyName", "data.company", "result.company"]],
    ["role", ["role", "targetRole", "data.role", "result.role"]],
    ["fileName", ["fileName", "filename", "data.fileName", "result.fileName"]],
    ["generatedAt", ["generatedAt", "data.generatedAt", "result.generatedAt"]],
    ["status", ["status", "data.status", "result.status"]],
    ["source", ["source", "data.source", "result.source"]],
    [
      "keywordCoverage",
      [
        "keywordCoverage",
        "coverage",
        "data.keywordCoverage",
        "result.keywordCoverage",
      ],
    ],
  ];

  for (const [labelKey, paths] of fields) {
    const value = firstNonEmptyString(
      payload,
      paths,
      labelKey === "fileName" ? fileName : ""
    );
    addMetadataEntry(entries, seen, labelKey, value);
  }

  for (const metadataPath of ["metadata", "data.metadata", "result.metadata"]) {
    const metadataRecord = asRecord(getNestedValue(payload, metadataPath));
    if (!metadataRecord) {
      continue;
    }

    for (const [key, value] of Object.entries(metadataRecord)) {
      if (Array.isArray(value)) {
        continue;
      }

      addMetadataEntry(entries, seen, key, toDisplayString(value));
    }
  }

  return entries;
}

function collectLinks(payload: unknown, fileName: string): LinkEntry[] {
  const entries: LinkEntry[] = [];
  const seen = new Set<string>();
  const candidateObjects = [
    payload,
    getNestedValue(payload, "links"),
    getNestedValue(payload, "data"),
    getNestedValue(payload, "data.links"),
    getNestedValue(payload, "result"),
    getNestedValue(payload, "result.links"),
    getNestedValue(payload, "resume"),
    getNestedValue(payload, "resume.links"),
    getNestedValue(payload, "output"),
    getNestedValue(payload, "output.links"),
  ];

  for (const candidate of candidateObjects) {
    const record = asRecord(candidate);
    if (!record) {
      continue;
    }

    for (const [key, rawValue] of Object.entries(record)) {
      if (typeof rawValue !== "string") {
        continue;
      }

      const href = normalizeLinkValue(key, rawValue, fileName);
      if (!href || seen.has(href)) {
        continue;
      }

      entries.push({
        key,
        label: buildLinkLabel(key, rawValue, href),
        href,
      });
      seen.add(href);
    }
  }

  const derivedDownloadUrl = buildDownloadUrl(fileName);
  if (derivedDownloadUrl && !seen.has(derivedDownloadUrl)) {
    entries.unshift({
      key: "downloadUrl",
      label: "Download .md",
      href: derivedDownloadUrl,
    });
  }

  return entries;
}

function normalizeLinkValue(
  key: string,
  value: string,
  fileName: string
): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  const keyLower = key.toLowerCase();
  if (keyLower === "filename" || keyLower === "filenameonly") {
    return "";
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmedValue)) {
    return trimmedValue;
  }

  if (
    trimmedValue.startsWith("/") ||
    trimmedValue.startsWith("./") ||
    trimmedValue.startsWith("../")
  ) {
    return resolveBackendAssetUrl(trimmedValue);
  }

  if (/^(api|output|downloads)\//i.test(trimmedValue)) {
    return resolveBackendAssetUrl(`/${trimmedValue.replace(/^\/+/, "")}`);
  }

  if (keyLower.includes("download") && FILE_LIKE_PATTERN.test(trimmedValue)) {
    return buildDownloadUrl(trimmedValue);
  }

  if (trimmedValue === fileName && FILE_LIKE_PATTERN.test(trimmedValue)) {
    return buildDownloadUrl(trimmedValue);
  }

  return "";
}

function buildLinkLabel(key: string, rawValue: string, href: string): string {
  const keyLower = key.toLowerCase();
  const extension = extensionFromValue(rawValue || href);

  if (keyLower.includes("preview") || extension === ".html") {
    return "Open preview";
  }

  if (keyLower.includes("download")) {
    return extension === ".md" || extension === ""
      ? "Download .md"
      : "Download generated file";
  }

  if (extension === ".md" || keyLower.includes("markdown")) {
    return "Open generated .md";
  }

  return "Open generated file";
}

function buildDownloadUrl(fileName: string): string {
  const normalizedName = basename(fileName);
  if (!normalizedName) {
    return "";
  }

  return resolveApiUrl(`resume/download/${encodeURIComponent(normalizedName)}`);
}

function resolveBackendAssetUrl(value: string): string {
  if (ABSOLUTE_URL_PATTERN.test(value)) {
    return value;
  }

  const backendOrigin = toApiBaseUrl().origin;
  if (value.startsWith("/")) {
    return new URL(value, backendOrigin).toString();
  }

  return new URL(value, `${backendOrigin}/`).toString();
}

function toApiBaseUrl(): URL {
  return new URL(
    `${getApiBaseUrl().replace(/\/+$/, "")}/`,
    window.location.href
  );
}

function normalizeApiBaseUrl(value: string): string {
  const trimmedValue = String(value || "").trim();
  return (trimmedValue || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function firstNonEmptyString(
  source: unknown,
  paths: string[],
  fallback = ""
): string {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    const displayValue = toDisplayString(value);
    if (displayValue) {
      return displayValue;
    }
  }

  return fallback;
}

function firstBoolean(
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

function stringArrayFromPaths(source: unknown, paths: string[]): string[] {
  const values: string[] = [];

  for (const path of paths) {
    values.push(...coerceStringArray(getNestedValue(source, path)));
  }

  return values;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmedValue = typeof value === "string" ? value.trim() : "";
    if (!trimmedValue || seen.has(trimmedValue)) {
      continue;
    }

    seen.add(trimmedValue);
    result.push(trimmedValue);
  }

  return result;
}

function getNestedValue(source: unknown, path: string): unknown {
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

function addMetadataEntry(
  entries: MetadataEntry[],
  seen: Set<string>,
  key: string,
  value: string
): void {
  const normalizedValue = value.trim();
  const normalizedKey = key.trim();

  if (!normalizedKey || !normalizedValue || seen.has(normalizedKey)) {
    return;
  }

  if (normalizedValue.includes("\n") || isProbablyLinkValue(normalizedValue)) {
    return;
  }

  seen.add(normalizedKey);
  entries.push({
    label: humanizeKey(normalizedKey),
    value: normalizedValue,
  });
}

function humanizeKey(key: string): string {
  if (HUMANIZED_LABELS[key]) {
    return HUMANIZED_LABELS[key];
  }

  return key
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function toDisplayString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getPayloadMessage(payload: unknown, status: number): string {
  const message = firstNonEmptyString(payload, [
    "error",
    "message",
    "data.error",
    "data.message",
  ]);
  return message || `Request failed with status ${status}`;
}

function normalizeUrl(value: string): string {
  if (!value.trim()) {
    return "";
  }

  if (ABSOLUTE_URL_PATTERN.test(value) || value.startsWith("mailto:")) {
    return value;
  }

  if (value.includes("@") && !value.includes("/")) {
    return `mailto:${value}`;
  }

  return `https://${value.replace(/^\/\//, "")}`;
}

function displayUrl(value: string): string {
  if (!value) {
    return "";
  }

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
    toDisplayString(record.city),
    toDisplayString(record.state),
    toDisplayString(record.country),
  ]).join(", ");
}

function basename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).pop() || "";
}

function extensionFromValue(value: string): string {
  const base = basename(value.split("?")[0]?.split("#")[0] || "");
  const dotIndex = base.lastIndexOf(".");
  return dotIndex >= 0 ? base.slice(dotIndex).toLowerCase() : "";
}

function isProbablyLinkValue(value: string): boolean {
  return (
    ABSOLUTE_URL_PATTERN.test(value) ||
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    /^(api|output|downloads)\//i.test(value)
  );
}
