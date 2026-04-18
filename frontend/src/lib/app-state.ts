import {
  buildResumeGenerateRequest,
  type LinkEntry,
  type MetadataEntry,
  type ProfileSnapshot,
  type ResumeResult,
} from "./api";

export type Tone = "neutral" | "success" | "warning" | "error";

export interface FeedbackState {
  tone: Tone;
  message: string;
}

export interface ResultState {
  tone: Tone;
  stateLabel: string;
  title: string;
  message: string;
  metadata: MetadataEntry[];
  links: LinkEntry[];
  previewMarkdown: string;
  notes: string[];
}

export interface CvStatus {
  tone: Tone;
  label: string;
}

export interface ResumeRequestInput {
  company: string;
  role: string;
  jobDescription: string;
}

export const INITIAL_RESULT_STATE: ResultState = {
  tone: "neutral",
  stateLabel: "Idle",
  title: "No tailored Markdown resume yet",
  message:
    "Save your Markdown CV, paste a job description, and generate a tailored `.md` resume.",
  metadata: [],
  links: [],
  previewMarkdown: "",
  notes: [],
};

export function createLoadingCvFeedback(apiBaseUrl: string): FeedbackState {
  return {
    tone: "neutral",
    message: `Loading saved Markdown CV from ${apiBaseUrl}/cv...`,
  };
}

export function createLoadedCvFeedback(
  content: string,
  path: string,
  apiBaseUrl: string
): FeedbackState {
  return {
    tone: "neutral",
    message: content
      ? `Loaded ${path} from ${apiBaseUrl}/cv.`
      : `Loaded an empty ${path}. Start editing and save when ready.`,
  };
}

export function createProtectedLocalEditsFeedback(path: string): FeedbackState {
  return {
    tone: "warning",
    message: `Loaded the saved ${path}, but kept your local editor changes intact.`,
  };
}

export function createMissingCvFeedback(): FeedbackState {
  return {
    tone: "warning",
    message:
      "No saved `cv.md` was found yet. Start drafting here, then save once to create it.",
  };
}

export function createSaveSuccessFeedback(path: string): FeedbackState {
  return {
    tone: "success",
    message: `Saved ${path} successfully.`,
  };
}

export function createEmptyJobDescriptionResult(): ResultState {
  return {
    tone: "error",
    stateLabel: "Needs input",
    title: "Add a job description first",
    message:
      "Paste the responsibilities, requirements, or role brief before generating a tailored Markdown resume.",
    metadata: [],
    links: [],
    previewMarkdown: "",
    notes: [],
  };
}

export function createGeneratingResult(hasLocalEdits: boolean): ResultState {
  return {
    tone: "neutral",
    stateLabel: "Generating",
    title: "Generating tailored Markdown resume...",
    message: hasLocalEdits
      ? "Unsaved `cv.md` edits stay in the editor. The backend will use the latest saved snapshot."
      : "Sending the saved `cv.md`, role context, and job description to the backend.",
    metadata: [],
    links: [],
    previewMarkdown: "",
    notes: [],
  };
}

export function createGenerationSuccessResult(
  resumeResult: ResumeResult,
  fallbackCompany: string,
  fallbackRole: string
): ResultState {
  return {
    tone: "success",
    stateLabel: "Ready",
    title: buildResultTitle(
      resumeResult.fileName,
      resumeResult.company || fallbackCompany,
      resumeResult.role || fallbackRole
    ),
    message: resumeResult.message || buildResultMessage(resumeResult),
    metadata: resumeResult.metadata,
    links: resumeResult.links,
    previewMarkdown: resumeResult.previewMarkdown,
    notes: resumeResult.notes,
  };
}

export function createGenerationErrorResult(message: string): ResultState {
  return {
    tone: "error",
    stateLabel: "Error",
    title: "Markdown resume generation failed",
    message,
    metadata: [],
    links: [],
    previewMarkdown: "",
    notes: [],
  };
}

export function buildResumeRequest(
  input: ResumeRequestInput
): Record<string, string> {
  return buildResumeGenerateRequest({
    jobDescription: input.jobDescription,
    company: input.company,
    targetRole: input.role,
  });
}

export function getCvStatus(
  cvLoading: boolean,
  cvLoaded: boolean,
  cvMissing: boolean,
  hasLocalEdits: boolean,
  cvText: string
): CvStatus {
  if (cvLoading) {
    return { tone: "neutral", label: "Loading `cv.md`..." };
  }

  if (cvLoaded) {
    return {
      tone: hasLocalEdits ? "warning" : "success",
      label: hasLocalEdits ? "Unsaved edits" : "Saved copy loaded",
    };
  }

  if (cvMissing) {
    return { tone: "warning", label: "No saved `cv.md` yet" };
  }

  if (cvText.trim()) {
    return { tone: "warning", label: "Local draft only" };
  }

  return { tone: "error", label: "Load failed" };
}

export function buildProfileMeta(profile: ProfileSnapshot | null): string {
  if (!profile) {
    return "";
  }

  return [profile.headline, profile.location, profile.email]
    .filter(Boolean)
    .join(" | ");
}

export function buildResultTitle(
  fileName: string,
  company: string,
  role: string
): string {
  if (company && role) {
    return `${company} - ${role}`;
  }

  if (fileName) {
    return fileName;
  }

  if (company) {
    return `${company} tailored resume`;
  }

  if (role) {
    return `${role} tailored resume`;
  }

  return "Tailored Markdown resume ready";
}

export function getGenerateHint(
  cvMissing: boolean,
  cvText: string,
  hasLocalEdits: boolean
): string {
  if (cvMissing) {
    return cvText.trim()
      ? "Save your draft once to create `cv.md` before generating."
      : "Start drafting your CV, then save once to create `cv.md`.";
  }

  return hasLocalEdits
    ? "Unsaved `cv.md` edits are not included until you save them."
    : "Generation uses the latest saved `cv.md` snapshot.";
}

export function getDirtyNotice(options: {
  hasLocalEdits: boolean;
  lastSavedAt: Date | null;
  hasSavedCv: boolean;
  cvMissing: boolean;
}): string {
  if (options.hasLocalEdits) {
    return "You have unsaved local edits. Save before generating if you want them included.";
  }

  if (options.lastSavedAt) {
    return `Last saved ${formatTimestamp(options.lastSavedAt)}.`;
  }

  if (options.hasSavedCv) {
    return "Editor matches the saved Markdown CV.";
  }

  if (options.cvMissing) {
    return "No saved `cv.md` exists yet. Draft in the editor, then save to create it.";
  }

  return "You can keep drafting locally even if the backend is not available yet.";
}

export function formatCount(value: number, noun: string): string {
  return `${value.toLocaleString()} ${noun}${value === 1 ? "" : "s"}`;
}

export function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function buildResultMessage(resumeResult: ResumeResult): string {
  if (resumeResult.previewMarkdown) {
    return "Tailored Markdown resume generated successfully. Review the preview or download the `.md` file below.";
  }

  if (resumeResult.links.length) {
    return "Tailored Markdown resume generated. Use the links below to open or download the result.";
  }

  return "The backend completed the request, but did not include inline Markdown or a downloadable file link.";
}
