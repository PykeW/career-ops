import { formatCount, type CvStatus, type FeedbackState } from '../lib/app-state';

interface CvEditorPanelProps {
  cvStatus: CvStatus;
  saveButtonLabel: string;
  saveDisabled: boolean;
  saveFeedback: FeedbackState;
  cvText: string;
  dirtyNotice: string;
  onSave: () => void;
  onCvTextChange: (nextValue: string) => void;
}

export function CvEditorPanel(props: CvEditorPanelProps) {
  return (
    <section className="panel" aria-labelledby="cv-editor-title">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Source of truth</p>
          <h2 id="cv-editor-title">`cv.md` editor</h2>
        </div>
        <div className="panel-actions">
          <span className={`status-pill ${props.cvStatus.tone}`.trim()}>{props.cvStatus.label}</span>
          <button className="button primary" type="button" onClick={props.onSave} disabled={props.saveDisabled}>
            {props.saveButtonLabel}
          </button>
        </div>
      </div>

      <p className="panel-description">
        Local edits stay in the editor until you save them. Resume generation always uses the latest saved Markdown CV
        on disk.
      </p>

      <div className={`notice ${props.saveFeedback.tone}`.trim()} role="status" aria-live="polite">
        {props.saveFeedback.message}
      </div>

      <label className="field" htmlFor="cvEditor">
        <span className="field-label">Markdown CV content</span>
        <textarea
          id="cvEditor"
          spellCheck={false}
          placeholder="Load or draft your Markdown CV here"
          value={props.cvText}
          onChange={(event) => props.onCvTextChange(event.target.value)}
        />
      </label>

      <div className="panel-footer">
        <span>{formatCount(props.cvText.length, 'character')}</span>
        <span className="muted">{props.dirtyNotice}</span>
      </div>
    </section>
  );
}
