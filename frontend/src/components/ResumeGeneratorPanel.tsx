import type { FormEvent } from 'react';

import type { ResultState } from '../lib/app-state';
import { formatCount } from '../lib/app-state';
import { ResumeResultPanel } from './ResumeResultPanel';

interface ResumeGeneratorPanelProps {
  company: string;
  role: string;
  jobDescription: string;
  generateHint: string;
  generateButtonLabel: string;
  generateDisabled: boolean;
  result: ResultState;
  onCompanyChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onJobDescriptionChange: (value: string) => void;
  onGenerate: (event: FormEvent<HTMLFormElement>) => void;
}

export function ResumeGeneratorPanel(props: ResumeGeneratorPanelProps) {
  return (
    <section className="panel" aria-labelledby="resume-generator-title">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Tailor and export</p>
          <h2 id="resume-generator-title">Markdown resume generator</h2>
        </div>
        <span className={`status-pill ${props.result.tone}`.trim()}>{props.result.stateLabel}</span>
      </div>

      <p className="panel-description">
        Add optional company and role context, then paste the job description you want to tailor against. The client
        stays Markdown-first throughout the flow.
      </p>

      <form className="generator-form" onSubmit={props.onGenerate}>
        <div className="field-grid">
          <label className="field" htmlFor="companyInput">
            <span className="field-label">Company</span>
            <input
              id="companyInput"
              type="text"
              placeholder="Optional"
              value={props.company}
              onChange={(event) => props.onCompanyChange(event.target.value)}
            />
          </label>

          <label className="field" htmlFor="roleInput">
            <span className="field-label">Role</span>
            <input
              id="roleInput"
              type="text"
              placeholder="Optional"
              value={props.role}
              onChange={(event) => props.onRoleChange(event.target.value)}
            />
          </label>
        </div>

        <label className="field" htmlFor="jobDescriptionInput">
          <span className="field-label">Job description / requirements</span>
          <textarea
            id="jobDescriptionInput"
            spellCheck={false}
            placeholder="Paste the role summary, responsibilities, and requirements"
            value={props.jobDescription}
            onChange={(event) => props.onJobDescriptionChange(event.target.value)}
            required
          />
        </label>

        <div className="panel-footer generator-footer">
          <div className="helper-stack">
            <span className="muted">{props.generateHint}</span>
            <span>{formatCount(props.jobDescription.length, 'character')}</span>
          </div>
          <button className="button primary" type="submit" disabled={props.generateDisabled}>
            {props.generateButtonLabel}
          </button>
        </div>
      </form>

      <ResumeResultPanel result={props.result} />
    </section>
  );
}
