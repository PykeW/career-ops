import {
  buildCvRequest as buildContractCvRequest,
  buildResumeGenerateRequest as buildContractResumeGenerateRequest,
  normalizeCvResponse,
  normalizeErrorPayload,
  normalizeProfileResponse,
  normalizeResumeResult,
  type ContractCvResponse,
  type ContractErrorPayload,
  type ContractProfileResponse,
  type ContractResumeGenerateRequest,
  type ContractResumeResult,
} from "../../../shared/contracts/api-contract.mjs";

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
  fileName: "File name",
  generatedAt: "Generated at",
  keywords: "Keywords",
  language: "Language",
  targetRole: "Role",
  sourceCvPath: "Source CV",
  sourceProfilePath: "Source profile",
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

export function buildCvRequest(content: string): { content: string } {
  return buildContractCvRequest(content);
}

export function buildResumeGenerateRequest(
  payload: ContractResumeGenerateRequest
): Record<string, string> {
  return buildContractResumeGenerateRequest(payload);
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
    metadata: collectMetadata(normalized),
    links: collectLinks(normalized),
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

function collectMetadata(normalized: ContractResumeResult): MetadataEntry[] {
  const entries: MetadataEntry[] = [];

  addMetadataEntry(entries, "company", normalized.company);
  addMetadataEntry(entries, "targetRole", normalized.targetRole);
  addMetadataEntry(entries, "fileName", normalized.fileName);
  addMetadataEntry(entries, "generatedAt", normalized.generatedAt);
  addMetadataEntry(entries, "artifactType", normalized.artifactType);
  addMetadataEntry(entries, "language", normalized.language);
  addMetadataEntry(entries, "sourceCvPath", normalized.sourceCvPath);
  addMetadataEntry(
    entries,
    "sourceProfilePath",
    normalized.sourceProfilePath || ""
  );

  if (normalized.keywords.length) {
    addMetadataEntry(entries, "keywords", normalized.keywords.join(", "));
  }

  return entries;
}

function collectLinks(normalized: ContractResumeResult): LinkEntry[] {
  const downloadHref = normalizeDownloadHref(
    normalized.downloadPath,
    normalized.fileName
  );

  if (!downloadHref) {
    return [];
  }

  return [
    {
      key: "downloadPath",
      label: "Download .md",
      href: downloadHref,
    },
  ];
}

function normalizeDownloadHref(downloadPath: string, fileName: string): string {
  const trimmedPath = downloadPath.trim();
  if (trimmedPath) {
    if (ABSOLUTE_URL_PATTERN.test(trimmedPath)) {
      return trimmedPath;
    }

    if (
      trimmedPath.startsWith("/") ||
      trimmedPath.startsWith("./") ||
      trimmedPath.startsWith("../")
    ) {
      return resolveBackendAssetUrl(trimmedPath);
    }

    if (/^(api|output|downloads)\//i.test(trimmedPath)) {
      return resolveBackendAssetUrl(`/${trimmedPath.replace(/^\/+/, "")}`);
    }

    if (FILE_LIKE_PATTERN.test(trimmedPath)) {
      return buildDownloadUrl(trimmedPath);
    }
  }

  return fileName ? buildDownloadUrl(fileName) : "";
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

function addMetadataEntry(
  entries: MetadataEntry[],
  key: string,
  value: string
): void {
  const normalizedKey = key.trim();
  const normalizedValue = value.trim();

  if (!normalizedKey || !normalizedValue) {
    return;
  }

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

function basename(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).pop() || "";
}
