import { useEffect, useState, type FormEvent } from "react";

import {
  buildResumeGenerateRequest,
  extractResumeResult,
  fetchJson,
  getErrorMessage,
} from "../lib/api";
import {
  INITIAL_RESULT_STATE,
  createEmptyJobDescriptionResult,
  createGeneratingResult,
  createGenerationErrorResult,
  createGenerationSuccessResult,
  getGenerateHint,
  type ResultState,
} from "../lib/app-state";

interface UseResumeGenerationOptions {
  cvMissing: boolean;
  cvText: string;
  hasLocalEdits: boolean;
  suggestedRole: string;
}

interface UseResumeGenerationResult {
  company: string;
  role: string;
  jobDescription: string;
  generating: boolean;
  result: ResultState;
  hasJobDescription: boolean;
  generateHint: string;
  generateButtonLabel: string;
  generateDisabled: boolean;
  setCompany: (value: string) => void;
  setRole: (value: string) => void;
  setJobDescription: (value: string) => void;
  handleGenerate: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function useResumeGeneration(
  options: UseResumeGenerationOptions
): UseResumeGenerationResult {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ResultState>(INITIAL_RESULT_STATE);

  useEffect(() => {
    if (!options.suggestedRole) {
      return;
    }

    setRole((currentRole) => currentRole || options.suggestedRole);
  }, [options.suggestedRole]);

  const hasJobDescription = Boolean(jobDescription.trim());
  const generateHint = getGenerateHint(
    options.cvMissing,
    options.cvText,
    options.hasLocalEdits
  );
  const generateButtonLabel = generating
    ? "Generating..."
    : "Generate Markdown resume";
  const generateDisabled =
    generating || !hasJobDescription || options.cvMissing;

  async function handleGenerate(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (generating) {
      return;
    }

    const trimmedJobDescription = jobDescription.trim();
    if (!trimmedJobDescription) {
      setResult(createEmptyJobDescriptionResult());
      return;
    }

    const trimmedCompany = company.trim();
    const trimmedRole = role.trim();

    setGenerating(true);
    setResult(createGeneratingResult(options.hasLocalEdits));

    try {
      const payloadResponse = await fetchJson("resume/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          buildResumeGenerateRequest({
            company,
            targetRole: role,
            jobDescription,
          })
        ),
      });

      const resumeResult = extractResumeResult(payloadResponse);
      setResult(
        createGenerationSuccessResult(resumeResult, trimmedCompany, trimmedRole)
      );
    } catch (error) {
      setResult(
        createGenerationErrorResult(
          getErrorMessage(
            error,
            "The backend could not generate a tailored Markdown resume right now."
          )
        )
      );
    } finally {
      setGenerating(false);
    }
  }

  return {
    company,
    role,
    jobDescription,
    generating,
    result,
    hasJobDescription,
    generateHint,
    generateButtonLabel,
    generateDisabled,
    setCompany,
    setRole,
    setJobDescription,
    handleGenerate,
  };
}
