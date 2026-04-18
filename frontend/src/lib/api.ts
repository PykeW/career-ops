import {
  buildCvRequest as buildCanonicalCvRequest,
  buildResumeGenerateRequest as buildCanonicalResumeGenerateRequest,
  normalizeCvResponse,
  normalizeErrorPayload,
  normalizeProfileResponse,
  normalizeResumeResult,
  type ContractCvResponse,
  type ContractErrorPayload,
  type ContractProfileResponse,
  type ContractResumeResult,
} from "../../../shared/contracts/api-contract";

export interface CvDocument extends ContractCvResponse {}

export interface MetadataEntry {
  label: string;
  value: string;
}

export interface LinkEntry {
  key: string;
  label: string;
  href: string;
}
export type ProfileSnapshot = ContractProfileResponse["snapshot"];

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
  payload?: ContractErrorPayload | unknown;
}

const ABSOLUTE_URL_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;
const FILE_LIKE_PATTERN = /\.[a-z\d]{1,8}(?:[?#].*)?$/i;
const HUMANIZED_LABELS: Record<string, string> = {
  artifactType: "Artifact type",
  company: "Company",
  companyName: "Company",
  fileName: "File name",
  filename: "File name",
  generatedAt: "Generated at",
  keywordCoverage: "Keyword coverage",
  language: "Language",
  role: "Role",
  sourceCvPath: "Source CV",
  sourceProfilePath: "Source profile",
  status: "Status",
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
    const errorPayload = normalizeErrorPayload(
      payload,
      `Request failed with status ${response.status}`
    );
    const error = new Error(errorPayload.error) as ApiError;
    error.status = response.status;
    error.payload = errorPayload;
    throw error;
  }

  return (payload && typeof payload === "object" ? payload : {}) as T;
}

export function buildCvRequest(
  content: string
): ReturnType<typeof buildCanonicalCvRequest> {
  return buildCanonicalCvRequest(content);
}

export function buildResumeGenerateRequest(payload: {
  jobDescription: string;
  company?: string;
  targetRole?: string;
}): Record<string, string> {
  return buildCanonicalResumeGenerateRequest(payload);
}

export function extractCvDocument(payload: unknown): CvDocument {
  return normalizeCvResponse(payload);
}

export function extractProfileSnapshot(payload: unknown): ProfileSnapshot {
  return normalizeProfileResponse(payload).snapshot;
}

export function extractResumeResult(payload: unknown): ResumeResult {
  const normalized = normalizeResumeResult(payload);

  return {
    previewMarkdown: normalized.previewMarkdown,
    fileName: normalized.fileName,
    company: normalized.company,
    role: normalized.targetRole,
    message: normalized.message,
    metadata: collectMetadata(payload, normalized),
    links: collectLinks(payload, normalized),
    notes: normalized.notes,
  };
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "payload" in error) {
    const errorPayload = normalizeErrorPayload(
      (error as ApiError).payload,
      fallback
    );

    if (errorPayload.error.trim()) {
      return errorPayload.error.trim();
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function collectMetadata(
  payload: unknown,
  normalized: ContractResumeResult
): MetadataEntry[] {
  const entries: MetadataEntry[] = [];
  const seen = new Set<string>();
  const stableFields: Array<[string, string]> = [
    ["company", normalized.company],
    ["role", normalized.targetRole],
    ["fileName", normalized.fileName],
    ["generatedAt", normalized.generatedAt],
    ["artifactType", normalized.artifactType],
    ["language", normalized.language],
    ["sourceCvPath", normalized.sourceCvPath],
    ["sourceProfilePath", normalized.sourceProfilePath || ""],
  ];

  for (const [key, value] of stableFields) {
    addMetadataEntry(entries, seen, key, value);
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

  for (const [key, value] of [
    ["status", toDisplayString(getNestedValue(payload, "status"))],
    [
      "keywordCoverage",
      toDisplayString(getNestedValue(payload, "keywordCoverage")),
    ],
    ["keywordCoverage", toDisplayString(getNestedValue(payload, "coverage"))],
  ] as Array<[string, string]>) {
    addMetadataEntry(entries, seen, key, value);
  }

  return entries;
}

function collectLinks(
  payload: unknown,
  normalized: ContractResumeResult
): LinkEntry[] {
  const entries: LinkEntry[] = [];
  const seen = new Set<string>();
  const preferredDownloadHref = normalizePreferredDownloadHref(normalized);

  if (preferredDownloadHref) {
    entries.push({
      key: "downloadUrl",
      label: "Download .md",
      href: preferredDownloadHref,
    });
    seen.add(preferredDownloadHref);
  }

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

      const href = normalizeLinkValue(key, rawValue, normalized.fileName);
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

  return entries;
}

function normalizePreferredDownloadHref(
  normalized: ContractResumeResult
): string {
  if (normalized.downloadPath) {
    const preferredHref = normalizeLinkValue(
      "downloadPath",
      normalized.downloadPath,
      normalized.fileName
    );

    if (preferredHref) {
      return preferredHref;
    }
  }

  if (normalized.fileName) {
    return buildDownloadUrl(normalized.fileName);
  }

  return "";
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

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
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
