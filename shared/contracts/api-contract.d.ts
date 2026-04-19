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

export function buildCvRequest(content?: string): {
  content: string;
};

export function normalizeCvRequest(payload?: unknown): {
  content: string;
  provided: boolean;
};

export function buildCvResponse(
  payload?: Partial<ContractCvResponse>
): ContractCvResponse;

export function normalizeCvResponse(payload?: unknown): ContractCvResponse;

export function buildProfileResponse(payload?: {
  exists?: boolean;
  path?: string;
  profile?: Record<string, unknown> | null;
  raw?: string;
  source?: string;
  notes?: string[];
}): ContractProfileResponse;

export function normalizeProfileResponse(
  payload?: unknown
): ContractProfileResponse;

export function buildResumeGenerateRequest(payload?: {
  jobDescription?: string;
  company?: string;
  targetRole?: string;
}): {
  jobDescription: string;
  company?: string;
  targetRole?: string;
};

export function normalizeResumeGenerateRequest(payload?: unknown): {
  jobDescription: string;
  company: string;
  targetRole: string;
};

export function buildResumeResult(
  payload?: Partial<ContractResumeResult>
): ContractResumeResult;

export function normalizeResumeResult(payload?: unknown): ContractResumeResult;

export function buildErrorPayload(
  error?: string,
  details?: unknown
): ContractErrorPayload;

export function normalizeErrorPayload(
  payload?: unknown,
  fallback?: string
): ContractErrorPayload;
