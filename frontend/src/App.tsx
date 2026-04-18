import { getApiBaseUrl } from "./lib/api";
import { buildProfileMeta } from "./lib/app-state";
import { CvEditorPanel } from "./components/CvEditorPanel";
import { ProfileCard } from "./components/ProfileCard";
import { ResumeGeneratorPanel } from "./components/ResumeGeneratorPanel";
import { useCvDocument } from "./hooks/useCvDocument";
import { useProfileSnapshot } from "./hooks/useProfileSnapshot";
import { useResumeGeneration } from "./hooks/useResumeGeneration";

import "./styles.css";

function App() {
  const apiBaseUrl = getApiBaseUrl();
  const cv = useCvDocument(apiBaseUrl);
  const profile = useProfileSnapshot();
  const generation = useResumeGeneration({
    cvMissing: cv.cvMissing,
    cvText: cv.cvText,
    hasLocalEdits: cv.hasLocalEdits,
    suggestedRole: profile.suggestedRole,
  });
  const profileMeta = buildProfileMeta(profile.profile);

  return (
    <div className="app-shell">
      <header className="hero">
        <section className="hero-copy">
          <p className="eyebrow">career-ops dedicated frontend</p>
          <h1>Markdown CV editor and tailored resume generator</h1>
          <p>
            Edit the canonical <code>cv.md</code>, save it explicitly, and
            generate a tailored Markdown resume from the latest saved snapshot
            plus a job description.
          </p>
          <p className="hero-note">
            API base: <code>{apiBaseUrl}</code>
          </p>
        </section>

        <ProfileCard
          profile={profile.profile}
          profileLoading={profile.profileLoading}
          profileError={profile.profileError}
          profileMeta={profileMeta}
        />
      </header>

      <main className="workspace">
        <CvEditorPanel
          cvStatus={cv.cvStatus}
          saveButtonLabel={cv.saveButtonLabel}
          saveDisabled={cv.saveDisabled}
          saveFeedback={cv.saveFeedback}
          cvText={cv.cvText}
          dirtyNotice={cv.dirtyNotice}
          onSave={() => {
            void cv.handleSaveCv();
          }}
          onCvTextChange={cv.updateCvText}
        />

        <ResumeGeneratorPanel
          company={generation.company}
          role={generation.role}
          jobDescription={generation.jobDescription}
          generateHint={generation.generateHint}
          generateButtonLabel={generation.generateButtonLabel}
          generateDisabled={generation.generateDisabled}
          result={generation.result}
          onCompanyChange={generation.setCompany}
          onRoleChange={generation.setRole}
          onJobDescriptionChange={generation.setJobDescription}
          onGenerate={(event) => {
            void generation.handleGenerate(event);
          }}
        />
      </main>

      <footer className="footer-note">
        <span>
          Configure <code>VITE_API_BASE_URL</code> to point at another backend.
          Default: <code>http://127.0.0.1:8787/api</code>.
        </span>
      </footer>
    </div>
  );
}

export default App;
