import { useEffect, useRef, useState } from "react";

import {
  buildCvRequest,
  extractCvDocument,
  fetchJson,
  getErrorMessage,
} from "../lib/api";
import {
  createLoadedCvFeedback,
  createLoadingCvFeedback,
  createMissingCvFeedback,
  createProtectedLocalEditsFeedback,
  createSaveSuccessFeedback,
  getCvStatus,
  getDirtyNotice,
  type CvStatus,
  type FeedbackState,
} from "../lib/app-state";

interface UseCvDocumentResult {
  cvText: string;
  cvSaving: boolean;
  cvLoaded: boolean;
  cvMissing: boolean;
  hasLocalEdits: boolean;
  saveFeedback: FeedbackState;
  saveButtonLabel: string;
  saveDisabled: boolean;
  cvStatus: CvStatus;
  dirtyNotice: string;
  updateCvText: (nextValue: string) => void;
  handleSaveCv: () => Promise<void>;
}

export function useCvDocument(apiBaseUrl: string): UseCvDocumentResult {
  const userEditedCvRef = useRef(false);

  const [cvText, setCvText] = useState("");
  const [persistedCv, setPersistedCv] = useState("");
  const [cvLoading, setCvLoading] = useState(true);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [cvMissing, setCvMissing] = useState(false);
  const [cvSaving, setCvSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<FeedbackState>(
    createLoadingCvFeedback(apiBaseUrl)
  );

  useEffect(() => {
    async function loadCv(): Promise<void> {
      setCvLoading(true);
      setSaveFeedback(createLoadingCvFeedback(apiBaseUrl));

      try {
        const payload = await fetchJson("cv");
        const cvDocument = extractCvDocument(payload);

        setPersistedCv(cvDocument.content);
        setCvLoaded(true);
        setCvMissing(false);

        if (!userEditedCvRef.current) {
          setCvText(cvDocument.content);
          setSaveFeedback(
            createLoadedCvFeedback(
              cvDocument.content,
              cvDocument.path,
              apiBaseUrl
            )
          );
          return;
        }

        setSaveFeedback(createProtectedLocalEditsFeedback(cvDocument.path));
      } catch (error) {
        const status =
          typeof error === "object" && error && "status" in error
            ? Number((error as { status?: number }).status)
            : 0;
        const missing = status === 404;

        setCvMissing(missing);
        setCvLoaded(false);
        setSaveFeedback(
          missing
            ? createMissingCvFeedback()
            : {
                tone: "error",
                message: getErrorMessage(
                  error,
                  `Could not load ${apiBaseUrl}/cv. You can keep editing locally and try saving again later.`
                ),
              }
        );
      } finally {
        setCvLoading(false);
      }
    }

    void loadCv();
  }, [apiBaseUrl]);

  const hasLocalEdits = cvText !== persistedCv;
  const hasSavedCv = cvLoaded && !cvMissing;
  const cvStatus = getCvStatus(
    cvLoading,
    cvLoaded,
    cvMissing,
    hasLocalEdits,
    cvText
  );
  const saveButtonLabel = cvSaving
    ? "Saving..."
    : hasLocalEdits || !cvLoaded
    ? "Save `cv.md`"
    : "Saved";
  const saveDisabled = cvSaving || (!hasLocalEdits && cvLoaded);
  const dirtyNotice = getDirtyNotice({
    hasLocalEdits,
    lastSavedAt,
    hasSavedCv,
    cvMissing,
  });

  function updateCvText(nextValue: string): void {
    userEditedCvRef.current = true;
    setCvText(nextValue);
  }

  async function handleSaveCv(): Promise<void> {
    if (cvSaving) {
      return;
    }

    setCvSaving(true);
    setSaveFeedback({ tone: "neutral", message: "Saving `cv.md`..." });

    try {
      const payload = await fetchJson("cv", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildCvRequest(cvText)),
      });

      const cvDocument = extractCvDocument(payload);
      const nextContent = cvDocument.content || cvText;

      setPersistedCv(nextContent);
      setCvText(nextContent);
      setCvLoaded(true);
      setCvMissing(false);
      setLastSavedAt(new Date());
      setSaveFeedback(createSaveSuccessFeedback(cvDocument.path));
    } catch (error) {
      setSaveFeedback({
        tone: "error",
        message: getErrorMessage(error, "Saving `cv.md` failed."),
      });
    } finally {
      setCvSaving(false);
    }
  }

  return {
    cvText,
    cvSaving,
    cvLoaded,
    cvMissing,
    hasLocalEdits,
    saveFeedback,
    saveButtonLabel,
    saveDisabled,
    cvStatus,
    dirtyNotice,
    updateCvText,
    handleSaveCv,
  };
}
