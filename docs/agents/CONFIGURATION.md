# Configuration

This reference summarizes the repository files that control personalization, shared defaults, and optional local tooling.

## Runtime Settings

| File | Role |
|------|------|
| `config/profile.yml` | Primary candidate profile with `candidate`, `target_roles`, `narrative`, `compensation`, and `location` sections. |
| `modes/_profile.md` | Personal override file for archetypes, framing, negotiation scripts, and location policy. |
| `portals.yml` | Scanner configuration copied from `templates/portals.example.yml`. |
| `cv.md` | Canonical CV input used by evaluations and PDF generation. |
| `article-digest.md` | Optional proof-point source for deeper personalization. |

## Shared Defaults

- `../../modes/_shared.md` contains shared system prompts and should not become the home for one user's private customization.
- `../../templates/states.yml` defines the canonical tracker labels: `Evaluated`, `Applied`, `Responded`, `Interview`, `Offer`, `Rejected`, `Discarded`, and `SKIP`.
- `../../templates/cv-template.html` controls the HTML layout and design tokens used by PDF generation.
- `../../templates/portals.example.yml` documents `title_filter`, `search_queries`, and `tracked_companies` for scanner setup.

## Customization Points

- Update `config/profile.yml` for identity, target roles, compensation, and location data.
- Update `modes/_profile.md` for user-specific role framing, negotiation scripts, and other long-lived overrides.
- Update `portals.yml` for positive and negative title filters, search queries, and tracked companies.
- Update `templates/cv-template.html` and `../../fonts/` only when you want to change the PDF design itself.
- Use the language-specific mode directories in `../../modes/de`, `../../modes/fr`, `../../modes/ja`, `../../modes/pt`, and `../../modes/ru` when the workflow needs localized instructions.

## Boundaries and Optional Environment Tooling

- `../../DATA_CONTRACT.md` defines which files are user-owned and which files are safe to update.
- `../../CLAUDE.md` explicitly directs user-specific customization into `config/profile.yml` and `modes/_profile.md`, not `modes/_shared.md`.
- `.envrc` and `flake.nix` provide optional direnv/Nix environment support; the repository does not document a separate application-level environment-variable surface in the checked-in docs.

For the canonical customization walkthrough, see `../CUSTOMIZATION.md`.
