import { useEffect, useRef, useState, type FormEvent } from 'react';

import {
  extractCvDocument,
  extractProfileSnapshot,
  extractResumeResult,
  fetchJson,
  getApiBaseUrl,
  getErrorMessage,
  type LinkEntry,
  type MetadataEntry,
  type ProfileSnapshot,
} from './lib/api';

import './styles.css';

type Tone = 'neutral' | 'success' | 'warning' | 'error';

interface FeedbackState {
  tone: Tone;
  message: string;
}

interface ResultState {
  tone: Tone;
  stateLabel: string;
  title: string;
  message: string;
  metadata: MetadataEntry[];
  links: LinkEntry[];
  previewMarkdown: string;
  notes: string[];
}

const INITIAL_RESULT_STATE: ResultState = {
  tone: 'neutral',
  stateLabel: 'Idle',
  title: 'No tailored Markdown resume yet',
  message: 'Save your Markdown CV, paste a job description, and generate a tailored `.md` resume.',
  metadata: [],
  links: [],
  previewMarkdown: '',
  notes: [],
};

function App() {
  const apiBaseUrl = getApiBaseUrl();
  const userEditedCvRef = useRef(false);

  const [cvText, setCvText] = useState('');
  const [persistedCv, setPersistedCv] = useState('');
  const [cvLoading, setCvLoading] = useState(true);
  const [cvLoaded, setCvLoaded] = useState(false);
  const [cvMissing, setCvMissing] = useState(false);
  const [cvSaving, setCvSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<FeedbackState>({
    tone: 'neutral',
    message: `Loading saved Markdown CV from ${apiBaseUrl}/cv...`,
  });

  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ResultState>(INITIAL_RESULT_STATE);

  const hasLocalEdits = cvText !== persistedCv;
  const hasJobDescription = Boolean(jobDescription.trim());
  const hasSavedCv = cvLoaded && !cvMissing;

  useEffect(() => {
    void loadCv();
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCv(): Promise<void> {
    setCvLoading(true);
    setSaveFeedback({
      tone: 'neutral',
      message: `Loading saved Markdown CV from ${apiBaseUrl}/cv...`,
    });

    try {
      const payload = await fetchJson('cv');
      const cvDocument = extractCvDocument(payload);

      setPersistedCv(cvDocument.content);
      setCvLoaded(true);
      setCvMissing(false);

      if (!userEditedCvRef.current) {
        setCvText(cvDocument.content);
        setSaveFeedback({
          tone: 'neutral',
          message: cvDocument.content
            ? `Loaded ${cvDocument.path} from ${apiBaseUrl}/cv.`
            : `Loaded an empty ${cvDocument.path}. Start editing and save when ready.`,
        });
      } else {
        setSaveFeedback({
          tone: 'warning',
          message: `Loaded the saved ${cvDocument.path}, but kept your local editor changes intact.`,
        });
      }
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error
        ? Number((error as { status?: number }).status)
        : 0;
      const missing = status === 404;

      setCvMissing(missing);
      setCvLoaded(false);
      setSaveFeedback({
        tone: missing ? 'warning' : 'error',
        message: missing
          ? 'No saved `cv.md` was found yet. Start drafting here, then save once to create it.'
          : getErrorMessage(
              error,
              `Could not load ${apiBaseUrl}/cv. You can keep editing locally and try saving again later.`,
            ),
      });
    } finally {
      setCvLoading(false);
    }
  }

  async function loadProfile(): Promise<void> {
    setProfileLoading(true);

    try {
      const payload = await fetchJson('profile');
      const snapshot = extractProfileSnapshot(payload);

      setProfile(snapshot);
      setProfileError('');
      setRole((currentRole) => currentRole || snapshot.targetRoles[0] || '');
    } catch (error) {
      setProfile(null);
      setProfileError(
        getErrorMessage(
          error,
          'The UI still works without profile data. A snapshot will appear here once `/api/profile` is available.',
        ),
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleSaveCv(): Promise<void> {
    if (cvSaving) {
      return;
    }

    setCvSaving(true);
    setSaveFeedback({ tone: 'neutral', message: 'Saving `cv.md`...' });

    try {
      const payload = await fetchJson('cv', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: cvText,
          cvContent: cvText,
          markdown: cvText,
        }),
      });

      const cvDocument = extractCvDocument(payload);
      const nextContent = cvDocument.content || cvText;

      setPersistedCv(nextContent);
      setCvText(nextContent);
      setCvLoaded(true);
      setCvMissing(false);
      setLastSavedAt(new Date());
      setSaveFeedback({
        tone: 'success',
        message: `Saved ${cvDocument.path} successfully.`,
      });
    } catch (error) {
      setSaveFeedback({
        tone: 'error',
        message: getErrorMessage(error, 'Saving `cv.md` failed.'),
      });
    } finally {
      setCvSaving(false);
    }
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (generating) {
      return;
    }

    const trimmedJobDescription = jobDescription.trim();
    if (!trimmedJobDescription) {
      setResult({
        tone: 'error',
        stateLabel: 'Needs input',
        title: 'Add a job description first',
        message: 'Paste the responsibilities, requirements, or role brief before generating a tailored Markdown resume.',
        metadata: [],
        links: [],
        previewMarkdown: '',
        notes: [],
      });
      return;
    }

    const trimmedCompany = company.trim();
    const trimmedRole = role.trim();
    const payload: Record<string, string> = {
      jobDescription: trimmedJobDescription,
    };

    if (trimmedCompany) {
      payload.company = trimmedCompany;
      payload.companyName = trimmedCompany;
    }

    if (trimmedRole) {
      payload.role = trimmedRole;
      payload.targetRole = trimmedRole;
    }

    setGenerating(true);
    setResult({
      tone: 'neutral',
      stateLabel: 'Generating',
      title: 'Generating tailored Markdown resume...',
      message: hasLocalEdits
        ? 'Unsaved `cv.md` edits stay in the editor. The backend will use the latest saved snapshot.'
        : 'Sending the saved `cv.md`, role context, and job description to the backend.',
      metadata: [],
      links: [],
      previewMarkdown: '',
      notes: [],
    });

    try {
      const payloadResponse = await fetchJson('resume/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const resumeResult = extractResumeResult(payloadResponse);
      setResult({
        tone: 'success',
        stateLabel: 'Ready',
        title: buildResultTitle(resumeResult.fileName, resumeResult.company || trimmedCompany, resumeResult.role || trimmedRole),
        message: resumeResult.message
          || (resumeResult.previewMarkdown
            ? 'Tailored Markdown resume generated successfully. Review the preview or download the `.md` file below.'
            : resumeResult.links.length
              ? 'Tailored Markdown resume generated. Use the links below to open or download the result.'
              : 'The backend completed the request, but did not include inline Markdown or a downloadable file link.'),
        metadata: resumeResult.metadata,
        links: resumeResult.links,
        previewMarkdown: resumeResult.previewMarkdown,
        notes: resumeResult.notes,
      });
    } catch (error) {
      setResult({
        tone: 'error',
        stateLabel: 'Error',
        title: 'Markdown resume generation failed',
        message: getErrorMessage(error, 'The backend could not generate a tailored Markdown resume right now.'),
        metadata: [],
        links: [],
        previewMarkdown: '',
        notes: [],
      });
    } finally {
      setGenerating(false);
    }
  }

  const cvStatus = getCvStatus(cvLoading, cvLoaded, cvMissing, hasLocalEdits, cvText);
  const saveButtonLabel = cvSaving ? 'Saving...' : hasLocalEdits || !cvLoaded ? 'Save `cv.md`' : 'Saved';
  const generateButtonLabel = generating ? 'Generating...' : 'Generate Markdown resume';
  const generateHint = cvMissing
    ? cvText.trim()
      ? 'Save your draft once to create `cv.md` before generating.'
      : 'Start drafting your CV, then save once to create `cv.md`.'
    : hasLocalEdits
      ? 'Unsaved `cv.md` edits are not included until you save them.'
      : 'Generation uses the latest saved `cv.md` snapshot.';
  const dirtyNotice = hasLocalEdits
    ? 'You have unsaved local edits. Save before generating if you want them included.'
    : lastSavedAt
      ? `Last saved ${formatTimestamp(lastSavedAt)}.`
      : hasSavedCv
        ? 'Editor matches the saved Markdown CV.'
        : cvMissing
          ? 'No saved `cv.md` exists yet. Draft in the editor, then save to create it.'
          : 'You can keep drafting locally even if the backend is not available yet.';
  const profileMeta = buildProfileMeta(profile);
  const profileTargetRoles = profile?.targetRoles || [];
  const profileNotes = profile?.notes || [];

  return (
    <div className="app-shell">
      <header className="hero">
        <section className="hero-copy">
          <p className="eyebrow">career-ops dedicated frontend</p>
          <h1>Markdown CV editor and tailored resume generator</h1>
          <p>
            Edit the canonical <code>cv.md</code>, save it explicitly, and generate a tailored Markdown resume from the
            latest saved snapshot plus a job description.
          </p>
          <p className="hero-note">
            API base: <code>{apiBaseUrl}</code>
          </p>
        </section>

        <aside className={`profile-card${profileError ? ' is-muted' : ''}`} aria-live="polite">
          <p className="section-kicker">Optional profile snapshot</p>
          <h2>
            {profileLoading ? 'Loading profile...' : profile?.name || 'Profile unavailable'}
          </h2>
          <p className="muted">
            {profileLoading
              ? 'Reading `/api/profile` to prefill summary details and default role context.'
              : profileError || profileMeta || 'Profile data loaded from `/api/profile`.'}
          </p>

          {profile && !profileLoading ? (
            <div className="profile-details">
              <dl className="metadata-list compact">
                <div>
                  <dt>Source</dt>
                  <dd>{profile.source || 'fallback'}</dd>
                </div>
                {profile.email ? (
                  <div>
                    <dt>Email</dt>
                    <dd>{profile.email}</dd>
                  </div>
                ) : null}
                {profile.location ? (
                  <div>
                    <dt>Location</dt>
                    <dd>{profile.location}</dd>
                  </div>
                ) : null}
              </dl>

              {profileTargetRoles.length ? (
                <div className="stack-block">
                  <p className="field-label">Suggested roles</p>
                  <div className="tag-list">
                    {profileTargetRoles.map((targetRole) => (
                      <span className="tag" key={targetRole}>{targetRole}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {(profile.linkedinUrl || profile.portfolioUrl || profile.github) ? (
                <div className="stack-block">
                  <p className="field-label">Links</p>
                  <div className="inline-links">
                    {profile.linkedinUrl ? (
                      <a href={profile.linkedinUrl} target="_blank" rel="noreferrer">{profile.linkedinLabel || 'LinkedIn'}</a>
                    ) : null}
                    {profile.portfolioUrl ? (
                      <a href={profile.portfolioUrl} target="_blank" rel="noreferrer">{profile.portfolioLabel || 'Portfolio'}</a>
                    ) : null}
                    {profile.github ? (
                      <span>{profile.github}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {profileNotes.length ? (
                <div className="stack-block">
                  <p className="field-label">Notes</p>
                  <ul className="note-list">
                    {profileNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </header>

      <main className="workspace">
        <section className="panel" aria-labelledby="cv-editor-title">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Source of truth</p>
              <h2 id="cv-editor-title">`cv.md` editor</h2>
            </div>
            <div className="panel-actions">
              <span className={`status-pill ${cvStatus.tone}`.trim()}>{cvStatus.label}</span>
              <button className="button primary" type="button" onClick={() => void handleSaveCv()} disabled={cvSaving || (!hasLocalEdits && cvLoaded)}>
                {saveButtonLabel}
              </button>
            </div>
          </div>

          <p className="panel-description">
            Local edits stay in the editor until you save them. Resume generation always uses the latest saved Markdown
            CV on disk.
          </p>

          <div className={`notice ${saveFeedback.tone}`.trim()} role="status" aria-live="polite">
            {saveFeedback.message}
          </div>

          <label className="field" htmlFor="cvEditor">
            <span className="field-label">Markdown CV content</span>
            <textarea
              id="cvEditor"
              spellCheck={false}
              placeholder="Load or draft your Markdown CV here"
              value={cvText}
              onChange={(event) => {
                userEditedCvRef.current = true;
                setCvText(event.target.value);
              }}
            />
          </label>

          <div className="panel-footer">
            <span>{formatCount(cvText.length, 'character')}</span>
            <span className="muted">{dirtyNotice}</span>
          </div>
        </section>

        <section className="panel" aria-labelledby="resume-generator-title">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Tailor and export</p>
              <h2 id="resume-generator-title">Markdown resume generator</h2>
            </div>
            <span className={`status-pill ${result.tone}`.trim()}>{result.stateLabel}</span>
          </div>

          <p className="panel-description">
            Add optional company and role context, then paste the job description you want to tailor against. The client
            stays Markdown-first throughout the flow.
          </p>

          <form className="generator-form" onSubmit={(event) => void handleGenerate(event)}>
            <div className="field-grid">
              <label className="field" htmlFor="companyInput">
                <span className="field-label">Company</span>
                <input
                  id="companyInput"
                  type="text"
                  placeholder="Optional"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </label>

              <label className="field" htmlFor="roleInput">
                <span className="field-label">Role</span>
                <input
                  id="roleInput"
                  type="text"
                  placeholder="Optional"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                />
              </label>
            </div>

            <label className="field" htmlFor="jobDescriptionInput">
              <span className="field-label">Job description / requirements</span>
              <textarea
                id="jobDescriptionInput"
                spellCheck={false}
                placeholder="Paste the role summary, responsibilities, and requirements"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                required
              />
            </label>

            <div className="panel-footer generator-footer">
              <div className="helper-stack">
                <span className="muted">{generateHint}</span>
                <span>{formatCount(jobDescription.length, 'character')}</span>
              </div>
              <button className="button primary" type="submit" disabled={generating || !hasJobDescription || cvMissing}>
                {generateButtonLabel}
              </button>
            </div>
          </form>

          <section className="result-card" aria-live="polite">
            <div className="result-header">
              <div>
                <p className="section-kicker">Output</p>
                <h3>{result.title}</h3>
              </div>
            </div>

            <p className="result-message">{result.message}</p>

            {result.metadata.length ? (
              <dl className="metadata-list">
                {result.metadata.map((entry) => (
                  <div key={`${entry.label}:${entry.value}`}>
                    <dt>{entry.label}</dt>
                    <dd>{entry.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {result.links.length ? (
              <div className="result-links">
                {result.links.map((link) => (
                  <a key={`${link.label}:${link.href}`} href={link.href} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}

            <div className="preview-shell">
              <div className="preview-header">
                <p className="field-label">Generated Markdown preview</p>
                {result.previewMarkdown ? <span className="muted">Inline preview returned by backend</span> : null}
              </div>
              <pre className="markdown-preview">
                <code>
                  {result.previewMarkdown
                    || 'No inline Markdown was returned yet. If the backend only provides links, use them to open or download the generated `.md` file.'}
                </code>
              </pre>
            </div>

            {result.notes.length ? (
              <div className="stack-block">
                <p className="field-label">Backend notes</p>
                <ul className="note-list">
                  {result.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </section>
      </main>

      <footer className="footer-note">
        <span>
          Configure <code>VITE_API_BASE_URL</code> to point at another backend. Default: <code>http://127.0.0.1:8787/api</code>.
        </span>
      </footer>
    </div>
  );
}

function getCvStatus(
  cvLoading: boolean,
  cvLoaded: boolean,
  cvMissing: boolean,
  hasLocalEdits: boolean,
  cvText: string,
): { tone: Tone; label: string } {
  if (cvLoading) {
    return { tone: 'neutral', label: 'Loading `cv.md`...' };
  }

  if (cvLoaded) {
    return {
      tone: hasLocalEdits ? 'warning' : 'success',
      label: hasLocalEdits ? 'Unsaved edits' : 'Saved copy loaded',
    };
  }

  if (cvMissing) {
    return { tone: 'warning', label: 'No saved `cv.md` yet' };
  }

  if (cvText.trim()) {
    return { tone: 'warning', label: 'Local draft only' };
  }

  return { tone: 'error', label: 'Load failed' };
}

function buildProfileMeta(profile: ProfileSnapshot | null): string {
  if (!profile) {
    return '';
  }

  return [profile.headline, profile.location, profile.email]
    .filter(Boolean)
    .join(' | ');
}

function buildResultTitle(fileName: string, company: string, role: string): string {
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

  return 'Tailored Markdown resume ready';
}

function formatCount(value: number, noun: string): string {
  return `${value.toLocaleString()} ${noun}${value === 1 ? '' : 's'}`;
}

function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

export default App;
