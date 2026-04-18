import type { ResultState } from '../lib/app-state';

interface ResumeResultPanelProps {
  result: ResultState;
}

export function ResumeResultPanel(props: ResumeResultPanelProps) {
  return (
    <section className="result-card" aria-live="polite">
      <div className="result-header">
        <div>
          <p className="section-kicker">Output</p>
          <h3>{props.result.title}</h3>
        </div>
      </div>

      <p className="result-message">{props.result.message}</p>

      {props.result.metadata.length ? (
        <dl className="metadata-list">
          {props.result.metadata.map((entry) => (
            <div key={`${entry.label}:${entry.value}`}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {props.result.links.length ? (
        <div className="result-links">
          {props.result.links.map((link) => (
            <a key={`${link.key}:${link.href}`} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </div>
      ) : null}

      <div className="preview-shell">
        <div className="preview-header">
          <p className="field-label">Generated Markdown preview</p>
          {props.result.previewMarkdown ? <span className="muted">Inline preview returned by backend</span> : null}
        </div>
        <pre className="markdown-preview">
          <code>
            {props.result.previewMarkdown
              || 'No inline Markdown was returned yet. If the backend only provides links, use them to open or download the generated `.md` file.'}
          </code>
        </pre>
      </div>

      {props.result.notes.length ? (
        <div className="stack-block">
          <p className="field-label">Backend notes</p>
          <ul className="note-list">
            {props.result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
