const state = {
  persistedCv: "",
  cvLoaded: false,
  cvLoading: true,
  cvSaving: false,
  cvMissing: false,
  cvLoadError: null,
  generating: false,
  profileLoading: true,
  profileError: false,
  hasLocalEdits: false,
  userEditedBeforeLoad: false,
  lastSavedAt: null,
};

const elements = {
  profileCard: document.getElementById("profileCard"),
  profileName: document.getElementById("profileName"),
  profileMeta: document.getElementById("profileMeta"),
  cvLoadState: document.getElementById("cvLoadState"),
  saveCvButton: document.getElementById("saveCvButton"),
  saveFeedback: document.getElementById("saveFeedback"),
  cvEditor: document.getElementById("cvEditor"),
  cvStats: document.getElementById("cvStats"),
  dirtyNotice: document.getElementById("dirtyNotice"),
  generateForm: document.getElementById("generateForm"),
  companyInput: document.getElementById("companyInput"),
  roleInput: document.getElementById("roleInput"),
  formatSelect: document.getElementById("formatSelect"),
  jobDescriptionInput: document.getElementById("jobDescriptionInput"),
  generateButton: document.getElementById("generateButton"),
  generateHint: document.getElementById("generateHint"),
  jobDescriptionStats: document.getElementById("jobDescriptionStats"),
  resultState: document.getElementById("resultState"),
  resultTitle: document.getElementById("resultTitle"),
  resultMessage: document.getElementById("resultMessage"),
  resultMetadata: document.getElementById("resultMetadata"),
  resultLinks: document.getElementById("resultLinks"),
};

const resultLinkLabels = {
  downloadUrl: "Download PDF",
  openUrl: "Open resume",
  url: "Open result",
  downloadPath: "Download PDF",
  openPath: "Open resume",
  path: "Open generated file",
  outputPath: "Open generated file",
  pdfPath: "Open generated file",
  filePath: "Open generated file",
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  updateUi();
  initialize();
});

function bindEvents() {
  elements.cvEditor.addEventListener("input", () => {
    if (!state.cvLoaded) {
      state.userEditedBeforeLoad = true;
    }

    state.hasLocalEdits = elements.cvEditor.value !== state.persistedCv;
    updateUi();
  });

  elements.jobDescriptionInput.addEventListener("input", updateUi);
  elements.saveCvButton.addEventListener("click", saveCv);
  elements.generateForm.addEventListener("submit", generateResume);
}

async function initialize() {
  await Promise.allSettled([loadCv(), loadProfile()]);
}

async function loadCv() {
  state.cvLoading = true;
  setSaveFeedback("Loading saved CV from /api/cv...", "neutral");
  updateUi();

  try {
    const payload = await fetchJson("/api/cv");
    const content = typeof payload.content === "string" ? payload.content : "";

    state.persistedCv = content;
    state.cvLoaded = true;
    state.cvMissing = false;
    state.cvLoadError = null;

    if (!state.userEditedBeforeLoad) {
      elements.cvEditor.value = content;
      setSaveFeedback(
        content
          ? "Loaded CV from /api/cv."
          : "Loaded an empty saved CV. Start writing and save when ready.",
        "neutral"
      );
    } else {
      setSaveFeedback(
        "Loaded the saved CV, but kept your local editor changes intact.",
        "warning"
      );
    }
  } catch (error) {
    state.cvMissing = error && error.status === 404;
    state.cvLoadError = error || new Error("CV load failed");
    setSaveFeedback(
      state.cvMissing
        ? "No saved cv.md was found yet. Start drafting here, then save to create it."
        : "Could not load /api/cv. You can keep drafting locally and try saving again when the backend is ready.",
      state.cvMissing ? "warning" : "error"
    );
  } finally {
    state.cvLoading = false;
    state.hasLocalEdits = elements.cvEditor.value !== state.persistedCv;
    updateUi();
  }
}

async function loadProfile() {
  state.profileLoading = true;
  updateUi();

  try {
    const payload = await fetchJson("/api/profile");
    hydrateProfile(payload);
  } catch (error) {
    state.profileError = true;
    elements.profileName.textContent = "Profile unavailable";
    elements.profileMeta.textContent =
      "The UI still works without profile data. Optional candidate details will appear here once /api/profile is available.";
    elements.profileCard.classList.add("is-muted");
  } finally {
    state.profileLoading = false;
  }
}

function hydrateProfile(payload) {
  const candidate =
    payload && typeof payload === "object" ? payload.candidate || payload : {};
  const narrative =
    payload && typeof payload === "object" ? payload.narrative || {} : {};
  const location =
    payload && typeof payload === "object" ? payload.location || {} : {};
  const primaryRoles = Array.isArray(payload?.target_roles?.primary)
    ? payload.target_roles.primary
    : Array.isArray(payload?.primaryRoles)
    ? payload.primaryRoles
    : [];

  const name =
    candidate.full_name ||
    candidate.fullName ||
    candidate.name ||
    candidate.displayName ||
    "Profile loaded";
  const metaBits = [
    narrative.headline,
    candidate.location || formatLocation(location),
    candidate.email,
    primaryRoles[0] ? "Target role: " + primaryRoles[0] : "",
  ].filter(Boolean);

  elements.profileName.textContent = name;
  elements.profileMeta.textContent = metaBits.length
    ? metaBits.join(" | ")
    : "Profile loaded from /api/profile.";
  elements.profileCard.classList.remove("is-muted");

  if (!elements.roleInput.value && primaryRoles[0]) {
    elements.roleInput.value = primaryRoles[0];
  }
}

async function saveCv() {
  if (state.cvSaving) {
    return;
  }

  state.cvSaving = true;
  setSaveFeedback("Saving CV...", "neutral");
  updateUi();

  try {
    await fetchJson("/api/cv", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: elements.cvEditor.value }),
    });

    state.persistedCv = elements.cvEditor.value;
    state.cvLoaded = true;
    state.lastSavedAt = new Date();
    state.hasLocalEdits = false;
    setSaveFeedback("CV saved successfully.", "success");
  } catch (error) {
    setSaveFeedback(getErrorMessage(error, "CV save failed."), "error");
  } finally {
    state.cvSaving = false;
    updateUi();
  }
}

async function generateResume(event) {
  event.preventDefault();

  if (state.generating) {
    return;
  }

  const jobDescription = elements.jobDescriptionInput.value.trim();
  if (!jobDescription) {
    setResult({
      tone: "error",
      stateLabel: "Needs input",
      title: "Add a job description first",
      message:
        "Paste the job requirements or responsibilities before generating a resume.",
      metadata: [],
      links: [],
    });
    return;
  }

  const payload = { jobDescription };
  const company = elements.companyInput.value.trim();
  const role = elements.roleInput.value.trim();
  const format = elements.formatSelect.value;

  if (company) {
    payload.company = company;
  }

  if (role) {
    payload.role = role;
  }

  if (format) {
    payload.format = format;
  }

  state.generating = true;
  setResult({
    tone: "neutral",
    stateLabel: "Generating",
    title: "Generating tailored resume...",
    message: state.hasLocalEdits
      ? "Unsaved CV edits stay in the editor. The backend will use the last saved CV snapshot."
      : "Sending the saved CV plus your job description to the backend.",
    metadata: [],
    links: [],
  });
  updateUi();

  try {
    const response = await fetchJson("/api/resume/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const metadata = collectMetadata(response);
    const links = collectLinks(response);
    const successMessage =
      typeof response.message === "string" && response.message.trim()
        ? response.message.trim()
        : links.length
        ? "Resume generated successfully. Use the link below to open or download the result."
        : "Resume generated successfully. The backend did not include a direct file link.";

    setResult({
      tone: "success",
      stateLabel: "Ready",
      title: buildResultTitle(response, company, role),
      message: successMessage,
      metadata,
      links,
    });
  } catch (error) {
    setResult({
      tone: "error",
      stateLabel: "Error",
      title: "Resume generation failed",
      message: getErrorMessage(
        error,
        "The backend could not generate a resume right now."
      ),
      metadata: [],
      links: [],
    });
  } finally {
    state.generating = false;
    updateUi();
  }
}

function updateUi() {
  const cvLength = elements.cvEditor.value.length;
  const jdLength = elements.jobDescriptionInput.value.length;
  const hasEditorText = elements.cvEditor.value.length > 0;
  const hasJobDescription = Boolean(elements.jobDescriptionInput.value.trim());

  elements.cvStats.textContent = formatCount(cvLength, "character");
  elements.jobDescriptionStats.textContent = formatCount(jdLength, "character");
  elements.saveCvButton.disabled =
    state.cvSaving || (!state.hasLocalEdits && state.cvLoaded);
  elements.generateButton.disabled =
    state.generating || !hasJobDescription || state.cvMissing;

  if (state.cvMissing) {
    elements.generateHint.textContent = hasEditorText
      ? "Save your draft once to create cv.md before generating."
      : "Start drafting your CV, then save once to create cv.md.";
  } else {
    elements.generateHint.textContent = state.hasLocalEdits
      ? "Unsaved CV edits are not included until you save them."
      : "Generation uses the latest saved CV snapshot.";
  }

  if (state.cvLoading) {
    setPill(elements.cvLoadState, "Loading CV...", "neutral");
  } else if (state.cvLoaded) {
    setPill(
      elements.cvLoadState,
      state.hasLocalEdits ? "Unsaved edits" : "Saved copy loaded",
      state.hasLocalEdits ? "warning" : "success"
    );
  } else if (state.cvMissing) {
    setPill(elements.cvLoadState, "No saved CV yet", "warning");
  } else if (hasEditorText) {
    setPill(elements.cvLoadState, "Local draft only", "warning");
  } else {
    setPill(elements.cvLoadState, "Load failed", "error");
  }

  if (state.cvSaving) {
    elements.saveCvButton.textContent = "Saving...";
  } else {
    elements.saveCvButton.textContent =
      state.hasLocalEdits || !state.cvLoaded ? "Save CV" : "Saved";
  }

  if (state.hasLocalEdits) {
    elements.dirtyNotice.textContent =
      "You have unsaved local edits. Save before generating if you want them included.";
  } else if (state.lastSavedAt) {
    elements.dirtyNotice.textContent =
      "Last saved " + formatTimestamp(state.lastSavedAt) + ".";
  } else if (state.cvLoaded) {
    elements.dirtyNotice.textContent = "Editor matches the saved CV.";
  } else if (state.cvMissing) {
    elements.dirtyNotice.textContent =
      "No saved cv.md exists yet. Draft in the editor, then save to create it.";
  } else {
    elements.dirtyNotice.textContent =
      "You can keep drafting locally even if the backend is not available yet.";
  }
}

function setSaveFeedback(message, tone) {
  elements.saveFeedback.textContent = message;
  elements.saveFeedback.dataset.tone = tone || "neutral";
}

function setResult({ tone, stateLabel, title, message, metadata, links }) {
  setPill(elements.resultState, stateLabel, tone);
  elements.resultTitle.textContent = title;
  elements.resultMessage.textContent = message;
  renderMetadata(metadata);
  renderLinks(links);
}

function renderMetadata(entries) {
  elements.resultMetadata.innerHTML = "";

  if (!entries.length) {
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    const term = document.createElement("dt");
    term.textContent = entry.label;
    const definition = document.createElement("dd");
    definition.textContent = entry.value;
    fragment.append(term, definition);
  }

  elements.resultMetadata.appendChild(fragment);
}

function renderLinks(links) {
  elements.resultLinks.innerHTML = "";

  for (const link of links) {
    const anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label;
    elements.resultLinks.appendChild(anchor);
  }
}

function collectMetadata(response) {
  if (!response || typeof response !== "object") {
    return [];
  }

  const entries = [];
  const seen = new Set();
  const preferredKeys = [
    "company",
    "role",
    "format",
    "filename",
    "generatedAt",
    "pageCount",
    "pages",
    "keywordCoverage",
    "coverage",
    "status",
  ];

  for (const key of preferredKeys) {
    addMetadataEntry(entries, seen, key, response[key]);
  }

  if (response.metadata && typeof response.metadata === "object") {
    for (const [key, value] of Object.entries(response.metadata)) {
      addMetadataEntry(entries, seen, key, value);
    }
  }

  return entries;
}

function addMetadataEntry(entries, seen, key, value) {
  if (seen.has(key) || value === undefined || value === null) {
    return;
  }

  if (typeof value === "object" || typeof value === "function") {
    return;
  }

  const normalized = String(value).trim();
  if (!normalized || isProbablyLinkValue(normalized)) {
    return;
  }

  entries.push({
    label: humanizeKey(key),
    value: normalized,
  });
  seen.add(key);
}

function collectLinks(response) {
  if (!response || typeof response !== "object") {
    return [];
  }

  const links = [];
  const seen = new Set();
  const candidates = [];

  for (const [key, value] of Object.entries(response)) {
    candidates.push([key, value]);
  }

  if (response.links && typeof response.links === "object") {
    for (const [key, value] of Object.entries(response.links)) {
      candidates.push([key, value]);
    }
  }

  for (const [key, value] of candidates) {
    if (typeof value !== "string") {
      continue;
    }

    const href = value.trim();
    if (!href || !isProbablyLinkValue(href) || seen.has(href)) {
      continue;
    }

    links.push({
      label:
        resultLinkLabels[key] ||
        (key.toLowerCase().includes("download")
          ? "Download PDF"
          : "Open result"),
      href,
    });
    seen.add(href);
  }

  return links;
}

function buildResultTitle(response, fallbackCompany, fallbackRole) {
  const company = stringify(response?.company) || fallbackCompany;
  const role = stringify(response?.role) || fallbackRole;
  const filename = stringify(response?.filename);

  if (company && role) {
    return company + " - " + role;
  }

  if (filename) {
    return filename;
  }

  return "Tailored resume ready";
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? safeJsonParse(text) : {};

  if (!response.ok) {
    const error = new Error(
      payload &&
      typeof payload === "object" &&
      typeof payload.error === "string"
        ? payload.error
        : "Request failed with status " + response.status
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload && typeof payload === "object") {
    return payload;
  }

  return {};
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
}

function getErrorMessage(error, fallback) {
  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function setPill(element, label, tone) {
  element.textContent = label;
  element.className =
    "status-pill" +
    (tone && tone !== "neutral"
      ? " " + tone
      : tone === "neutral"
      ? " neutral"
      : "");
}

function humanizeKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatLocation(location) {
  if (!location || typeof location !== "object") {
    return "";
  }

  return [location.city, location.country].filter(Boolean).join(", ");
}

function formatCount(value, noun) {
  return value.toLocaleString() + " " + noun + (value === 1 ? "" : "s");
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function isProbablyLinkValue(value) {
  return (
    /^(https?:\/\/|\/|\.\/|\.\.\/)/.test(value) ||
    value.endsWith(".pdf") ||
    value.startsWith("output/")
  );
}

function stringify(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}
