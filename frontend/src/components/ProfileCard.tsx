import type { ProfileSnapshot } from '../lib/api';

interface ProfileCardProps {
  profile: ProfileSnapshot | null;
  profileLoading: boolean;
  profileError: string;
  profileMeta: string;
}

export function ProfileCard(props: ProfileCardProps) {
  const profileTargetRoles = props.profile?.targetRoles || [];
  const profileNotes = props.profile?.notes || [];

  return (
    <aside className={`profile-card${props.profileError ? ' is-muted' : ''}`} aria-live="polite">
      <p className="section-kicker">Optional profile snapshot</p>
      <h2>{props.profileLoading ? 'Loading profile...' : props.profile?.name || 'Profile unavailable'}</h2>
      <p className="muted">
        {props.profileLoading
          ? 'Reading `/api/profile` to prefill summary details and default role context.'
          : props.profileError || props.profileMeta || 'Profile data loaded from `/api/profile`.'}
      </p>

      {props.profile && !props.profileLoading ? (
        <div className="profile-details">
          <dl className="metadata-list compact">
            <div>
              <dt>Source</dt>
              <dd>{props.profile.source || 'fallback'}</dd>
            </div>
            {props.profile.email ? (
              <div>
                <dt>Email</dt>
                <dd>{props.profile.email}</dd>
              </div>
            ) : null}
            {props.profile.location ? (
              <div>
                <dt>Location</dt>
                <dd>{props.profile.location}</dd>
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

          {(props.profile.linkedinUrl || props.profile.portfolioUrl || props.profile.github) ? (
            <div className="stack-block">
              <p className="field-label">Links</p>
              <div className="inline-links">
                {props.profile.linkedinUrl ? (
                  <a href={props.profile.linkedinUrl} target="_blank" rel="noreferrer">
                    {props.profile.linkedinLabel || 'LinkedIn'}
                  </a>
                ) : null}
                {props.profile.portfolioUrl ? (
                  <a href={props.profile.portfolioUrl} target="_blank" rel="noreferrer">
                    {props.profile.portfolioLabel || 'Portfolio'}
                  </a>
                ) : null}
                {props.profile.github ? <span>{props.profile.github}</span> : null}
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
  );
}
