import { mkdir, readFile, writeFile } from 'fs/promises';
import { spawn } from 'child_process';
import { basename, join } from 'path';

import { readCvFile, readProfileInfo } from './data.mjs';
import { outputDir, pdfGeneratorPath, templatePath } from './project-paths.mjs';

const SECTION_LABELS = {
  en: {
    summary: 'Professional Summary',
    competencies: 'Core Competencies',
    experience: 'Work Experience',
    projects: 'Projects',
    education: 'Education',
    certifications: 'Certifications',
    skills: 'Skills',
  },
  zh: {
    summary: 'Professional Summary',
    competencies: 'Core Competencies',
    experience: 'Work Experience',
    projects: 'Projects',
    education: 'Education',
    certifications: 'Certifications',
    skills: 'Skills',
  },
};

const SECTION_ALIASES = {
  summary: ['professional summary', 'summary', 'profile', 'about', 'resumen profesional'],
  experience: ['work experience', 'experience', 'employment', 'professional experience', 'recent engineering'],
  projects: ['projects', 'selected projects', 'personal projects'],
  education: ['education', 'academic background', 'formation'],
  certifications: ['certifications', 'certificates', 'licenses'],
  skills: ['skills', 'technical skills', 'competencies', 'tooling'],
};

const DEFAULT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'have', 'in', 'into', 'is', 'it', 'of', 'on',
  'or', 'our', 'that', 'the', 'their', 'this', 'to', 'will', 'with', 'you', 'your', 'we', 'who', 'about', 'across',
  'after', 'all', 'also', 'any', 'can', 'do', 'does', 'each', 'every', 'help', 'helps', 'if', 'job', 'join',
  'looking', 'make', 'more', 'must', 'need', 'needed', 'needs', 'new', 'not', 'one', 'role', 'team', 'teams',
  'using', 'work', 'working', 'years', 'year', 'plus', 'preferred', 'including', 'such', 'than', 'them', 'these',
  'those', 'through', 'while', 'where', 'which', 'within', 'would', 'should', 'skills', 'skill', 'requirements',
]);

const CJK_FONT_STACK = "'Noto Sans CJK SC', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', 'Heiti SC', 'WenQuanYi Micro Hei', sans-serif";

let templateCache;

export async function generateTailoredResume(input) {
  const jobDescription = typeof input.jobDescription === 'string' ? input.jobDescription.trim() : '';
  if (!jobDescription) {
    const error = new Error('jobDescription is required.');
    error.statusCode = 400;
    throw error;
  }

  const cvState = await readCvFile();
  if (!cvState.content.trim()) {
    const error = new Error('cv.md is missing or empty. Save CV content before generating a resume.');
    error.statusCode = 400;
    throw error;
  }

  const profile = await readProfileInfo({ cvContent: cvState.content });
  const parsedCv = parseCvMarkdown(cvState.content);
  const format = resolveFormat(input.format, jobDescription);
  const lang = detectLanguage(cvState.content, jobDescription);
  const labels = SECTION_LABELS[lang] || SECTION_LABELS.en;
  const keywordResult = extractKeywords(jobDescription, cvState.content, 12);
  const usedKeywords = keywordResult.matchedKeywords.slice(0, 8);
  const notes = [...profile.notes];

  if (usedKeywords.length === 0) {
    notes.push('No direct JD-to-CV keyword overlap was found, so the resume keeps the original section ordering.');
  }
  if (keywordResult.unusedKeywords.length > 0) {
    notes.push(`Ignored unmatched JD keywords to avoid inventing experience: ${keywordResult.unusedKeywords.slice(0, 8).join(', ')}`);
  }

  const renderedResume = await buildRenderedResume({
    company: input.company || '',
    cvContent: cvState.content,
    format,
    labels,
    lang,
    parsedCv,
    profile,
    role: input.role || '',
    usedKeywords,
  });

  if (renderedResume.usedCjkFallback) {
    notes.push('Applied a system-font fallback stack for CJK text. PDF output still depends on local CJK fonts being installed.');
  }

  await mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const candidateSlug = slugify(profile.candidate.fullName || parsedCv.name || 'candidate');
  const companySlug = slugify(input.company || 'targeted');
  const roleSlug = slugify(input.role || 'resume');
  const baseName = `resume-${candidateSlug}-${companySlug}-${roleSlug}-${timestamp}`;
  const htmlPath = join(outputDir, `${baseName}.html`);
  const pdfPath = join(outputDir, `${baseName}.pdf`);

  await writeFile(htmlPath, renderedResume.html, 'utf-8');
  await runPdfGenerator(htmlPath, pdfPath, format);

  const htmlFile = basename(htmlPath);
  const pdfFile = basename(pdfPath);

  return {
    ok: true,
    company: input.company || '',
    role: input.role || '',
    format,
    htmlPath: `/output/${htmlFile}`,
    pdfPath: `/output/${pdfFile}`,
    outputPath: `/output/${pdfFile}`,
    openUrl: `/output/${htmlFile}`,
    previewPath: `/output/${htmlFile}`,
    downloadPath: `/downloads/${pdfFile}`,
    downloadUrl: `/downloads/${pdfFile}`,
    path: `/downloads/${pdfFile}`,
    keywords: usedKeywords,
    notes,
  };
}

async function buildRenderedResume(input) {
  const profileCandidate = input.profile.candidate;
  const summaryText = input.parsedCv.summaryText || profileCandidate.headline || firstParagraph(input.cvContent);
  const experiences = rankExperience(input.parsedCv.experiences, input.usedKeywords);
  const projects = rankItems(input.parsedCv.projects, input.usedKeywords);
  const skills = rankItems(input.parsedCv.skills, input.usedKeywords);
  const competencies = buildCompetencies(input.usedKeywords, input.parsedCv, skills);
  const hasCjkText = containsCjk(input.cvContent + input.company + input.role);
  const templateHtml = await loadTemplateHtml();

  let html = renderTemplate(templateHtml, {
    '{{LANG}}': input.lang,
    '{{PAGE_WIDTH}}': input.format === 'letter' ? '8.5in' : '210mm',
    '{{NAME}}': escapeHtml(profileCandidate.fullName || input.parsedCv.name || 'Candidate'),
    '{{EMAIL}}': escapeHtml(profileCandidate.email || ''),
    '{{LINKEDIN_URL}}': escapeHtml(profileCandidate.linkedinUrl || '#'),
    '{{LINKEDIN_DISPLAY}}': escapeHtml(profileCandidate.linkedin || profileCandidate.linkedinUrl || ''),
    '{{PORTFOLIO_URL}}': escapeHtml(profileCandidate.portfolioUrl || '#'),
    '{{PORTFOLIO_DISPLAY}}': escapeHtml(profileCandidate.portfolioDisplay || profileCandidate.portfolioUrl || ''),
    '{{LOCATION}}': escapeHtml(profileCandidate.location || ''),
    '{{SECTION_SUMMARY}}': escapeHtml(input.labels.summary),
    '{{SUMMARY_TEXT}}': renderParagraphs(summaryText),
    '{{SECTION_COMPETENCIES}}': escapeHtml(input.labels.competencies),
    '{{COMPETENCIES}}': competencies,
    '{{SECTION_EXPERIENCE}}': escapeHtml(input.labels.experience),
    '{{EXPERIENCE}}': renderExperience(experiences),
    '{{SECTION_PROJECTS}}': escapeHtml(input.labels.projects),
    '{{PROJECTS}}': renderProjects(projects),
    '{{SECTION_EDUCATION}}': escapeHtml(input.labels.education),
    '{{EDUCATION}}': renderEducation(input.parsedCv.education),
    '{{SECTION_CERTIFICATIONS}}': escapeHtml(input.labels.certifications),
    '{{CERTIFICATIONS}}': renderSimpleList(input.parsedCv.certifications, 'certification'),
    '{{SECTION_SKILLS}}': escapeHtml(input.labels.skills),
    '{{SKILLS}}': renderSkills(skills),
  });

  if (hasCjkText) {
    html = applyCjkFallback(html);
  }

  return { html, usedCjkFallback: hasCjkText };
}

async function loadTemplateHtml() {
  if (!templateCache) {
    templateCache = await readFile(templatePath, 'utf-8');
  }
  return templateCache;
}

function renderTemplate(templateHtml, replacements) {
  return Object.entries(replacements).reduce(
    (html, [placeholder, value]) => html.split(placeholder).join(value),
    templateHtml,
  );
}

function parseCvMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let currentSection = { title: '', key: 'header', lines: [] };

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      sections.push(currentSection);
      currentSection = {
        title: headingMatch[1].trim(),
        key: mapSectionKey(headingMatch[1]),
        lines: [],
      };
      continue;
    }

    currentSection.lines.push(line);
  }
  sections.push(currentSection);

  return {
    name: extractName(lines),
    summaryText: cleanBlockText((findSection(sections, 'summary') || {}).lines || []),
    experiences: parseExperienceSection((findSection(sections, 'experience') || {}).lines || []),
    projects: parseProjectSection((findSection(sections, 'projects') || {}).lines || []),
    education: parseSimpleSection((findSection(sections, 'education') || {}).lines || []),
    certifications: parseSimpleSection((findSection(sections, 'certifications') || {}).lines || []),
    skills: parseSkillSection((findSection(sections, 'skills') || {}).lines || []),
  };
}

function findSection(sections, key) {
  return sections.find((section) => section.key === key);
}

function mapSectionKey(title) {
  const normalized = normalizeSearchText(title).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'other';
  }

  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return key;
    }
  }

  return 'other';
}

function extractName(lines) {
  const heading = lines.find((line) => /^#\s+/.test(line.trim()));
  if (!heading) {
    return '';
  }

  return heading
    .replace(/^#\s+/, '')
    .replace(/^(cv|resume|curriculum vitae)\s*[-:]+\s*/i, '')
    .trim();
}

function parseExperienceSection(lines) {
  const blocks = splitSubsections(lines);
  return blocks.map((block, index) => {
    const bodyLines = block.lines.map((line) => line.trim()).filter(Boolean);
    const { company, location } = splitHeading(block.title || `Experience ${index + 1}`);
    const roleIndex = bodyLines.findIndex((line) => /^\*\*.+\*\*$/.test(line) || isPlainTextLine(line));
    const role = roleIndex >= 0 ? stripMarkdown(bodyLines[roleIndex]) : '';
    const period = roleIndex >= 0 ? findPeriodLine(bodyLines.slice(roleIndex + 1)) : findPeriodLine(bodyLines);
    const bullets = bodyLines
      .filter((line) => /^[-*]\s+/.test(line))
      .map((line) => line.replace(/^[-*]\s+/, ''));
    const paragraphs = bodyLines
      .filter((line) => !/^[-*]\s+/.test(line))
      .filter((line, lineIndex) => lineIndex !== roleIndex)
      .filter((line) => stripMarkdown(line) !== period)
      .filter(Boolean);

    return {
      company: company || block.title || `Experience ${index + 1}`,
      location,
      role,
      period,
      bullets,
      paragraphs,
      order: index,
      textForScore: [company, location, role, period, ...bullets, ...paragraphs].join(' '),
    };
  });
}

function parseProjectSection(lines) {
  const items = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      if (current) {
        items.push(finalizeProject(current));
      }
      current = { title: headingMatch[1].trim(), lines: [] };
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (current) {
        items.push(finalizeProject(current));
      }
      current = { title: '', lines: [line.replace(/^[-*]\s+/, '')] };
      continue;
    }

    if (!current) {
      current = { title: '', lines: [] };
    }
    current.lines.push(line);
  }

  if (current) {
    items.push(finalizeProject(current));
  }

  return items
    .filter((item) => item.title || item.description)
    .map((item, index) => ({ ...item, order: index }));
}

function finalizeProject(project) {
  const firstLine = project.lines[0] || '';
  const formatted =
    firstLine.match(/^\*\*(.+?)\*\*\s*(?:\((.+?)\))?\s*[-:]+\s*(.*)$/) ||
    firstLine.match(/^`([^`]+)`\s*(?:\((.+?)\))?\s*[-:]+\s*(.*)$/);

  if (project.title) {
    return {
      title: project.title,
      badge: '',
      description: cleanBlockText(project.lines),
      tech: '',
      textForScore: [project.title, ...project.lines].join(' '),
    };
  }

  if (formatted) {
    return {
      title: formatted[1].trim(),
      badge: (formatted[2] || '').trim(),
      description: formatted[3].trim(),
      tech: '',
      textForScore: project.lines.join(' '),
    };
  }

  const [title, ...rest] = project.lines;
  return {
    title: stripMarkdown(title),
    badge: '',
    description: cleanBlockText(rest),
    tech: '',
    textForScore: project.lines.join(' '),
  };
}

function parseSimpleSection(lines) {
  const items = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      items.push({ text: line.replace(/^[-*]\s+/, ''), order: items.length, textForScore: line });
      continue;
    }

    items.push({ text: line, order: items.length, textForScore: line });
  }

  return items;
}

function parseSkillSection(lines) {
  return parseSimpleSection(lines).map((item) => {
    const match = item.text.match(/^\*\*(.+?)\*\*\s*[:\-]\s*(.+)$/);
    if (!match) {
      return item;
    }

    return {
      ...item,
      category: stripMarkdown(match[1]),
      text: match[2].trim(),
      textForScore: `${match[1]} ${match[2]}`,
    };
  });
}

function splitSubsections(lines) {
  const subsections = [];
  let current = null;

  for (const rawLine of lines) {
    const headingMatch = rawLine.match(/^###\s+(.+)$/);
    if (headingMatch) {
      if (current) {
        subsections.push(current);
      }
      current = { title: headingMatch[1].trim(), lines: [] };
      continue;
    }

    if (!current) {
      current = { title: '', lines: [] };
    }
    current.lines.push(rawLine);
  }

  if (current) {
    subsections.push(current);
  }

  return subsections.filter((section) => section.title || cleanBlockText(section.lines));
}

function splitHeading(title) {
  const parts = title.split(/\s+--\s+/);
  if (parts.length >= 2) {
    return { company: parts[0].trim(), location: parts.slice(1).join(' -- ').trim() };
  }
  return { company: title.trim(), location: '' };
}

function findPeriodLine(lines) {
  for (const line of lines) {
    const trimmed = stripMarkdown(line);
    if (/\b(19|20)\d{2}\b/.test(trimmed) || /present|current|至今/i.test(trimmed)) {
      return trimmed;
    }
  }
  return '';
}

function isPlainTextLine(line) {
  const trimmed = line.trim();
  return Boolean(trimmed) && !/^[-*#]/.test(trimmed) && trimmed.length <= 120;
}

function buildCompetencies(keywords, parsedCv, rankedSkills) {
  const values = [];
  const seen = new Set();

  for (const keyword of keywords) {
    pushUnique(values, seen, keyword);
  }

  for (const skill of rankedSkills) {
    const label = skill.category ? `${skill.category}: ${skill.text}` : skill.text;
    pushUnique(values, seen, label);
    if (values.length >= 8) {
      break;
    }
  }

  if (values.length === 0 && parsedCv.summaryText) {
    const fragments = parsedCv.summaryText.split(/[.;\n]/).map((value) => value.trim()).filter(Boolean);
    for (const fragment of fragments) {
      pushUnique(values, seen, fragment);
      if (values.length >= 6) {
        break;
      }
    }
  }

  return values
    .slice(0, 8)
    .map((value) => `<span class="competency-tag">${renderInlineMarkdown(value)}</span>`)
    .join('\n      ');
}

function pushUnique(values, seen, value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return;
  }

  const key = normalizeSearchText(trimmed);
  if (!key || seen.has(key)) {
    return;
  }

  seen.add(key);
  values.push(trimmed);
}

function rankExperience(items, keywords) {
  return items
    .map((item) => ({
      ...item,
      bullets: rankBulletLines(item.bullets, keywords),
      score: keywordScore(item.textForScore, keywords),
    }))
    .sort(sortByScore);
}

function rankItems(items, keywords) {
  return items
    .map((item) => ({ ...item, score: keywordScore(item.textForScore || item.text || '', keywords) }))
    .sort(sortByScore);
}

function rankBulletLines(bullets, keywords) {
  return bullets
    .map((bullet, index) => ({ bullet, score: keywordScore(bullet, keywords), index }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    })
    .map((item) => item.bullet);
}

function sortByScore(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  return left.order - right.order;
}

function keywordScore(text, keywords) {
  const haystack = normalizeSearchText(text);
  if (!haystack || keywords.length === 0) {
    return 0;
  }

  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) {
      return score;
    }

    if (haystack.includes(normalizedKeyword)) {
      return score + Math.max(1, normalizedKeyword.split(' ').length);
    }

    const tokens = normalizedKeyword.split(' ').filter(Boolean);
    const partialMatches = tokens.filter((token) => haystack.includes(token)).length;
    return score + partialMatches * 0.5;
  }, 0);
}

function renderExperience(items) {
  if (items.length === 0) {
    return '<div class="job"><div class="job-role">No experience section found in cv.md.</div></div>';
  }

  return items.map((item) => {
    const bulletHtml = item.bullets.length > 0
      ? `<ul>\n${item.bullets.map((bullet) => `  <li>${renderInlineMarkdown(bullet)}</li>`).join('\n')}\n</ul>`
      : '';
    const paragraphHtml = item.paragraphs
      .map((paragraph) => `<div class="job-location">${renderInlineMarkdown(paragraph)}</div>`)
      .join('\n');

    return [
      '<div class="job">',
      '  <div class="job-header">',
      `    <div class="job-company">${renderInlineMarkdown(item.company)}</div>`,
      `    <div class="job-period">${renderInlineMarkdown(item.period)}</div>`,
      '  </div>',
      `  <div class="job-role">${renderInlineMarkdown(item.role || item.location || item.company)}</div>`,
      item.location ? `  <div class="job-location">${renderInlineMarkdown(item.location)}</div>` : '',
      paragraphHtml,
      bulletHtml,
      '</div>',
    ].filter(Boolean).join('\n');
  }).join('\n');
}

function renderProjects(items) {
  if (items.length === 0) {
    return '<div class="project"><div class="project-desc">No projects section found in cv.md.</div></div>';
  }

  return items.map((item) => {
    const badge = item.badge ? `<span class="project-badge">${renderInlineMarkdown(item.badge)}</span>` : '';
    const tech = item.tech ? `<div class="project-tech">${renderInlineMarkdown(item.tech)}</div>` : '';

    return [
      '<div class="project">',
      `  <div class="project-title">${renderInlineMarkdown(item.title || 'Project')}${badge}</div>`,
      item.description ? `  <div class="project-desc">${renderInlineMarkdown(item.description)}</div>` : '',
      tech,
      '</div>',
    ].filter(Boolean).join('\n');
  }).join('\n');
}

function renderEducation(items) {
  if (items.length === 0) {
    return '<div class="edu-item"><div class="edu-desc">No education section found in cv.md.</div></div>';
  }

  return items.map((item) => {
    const text = stripMarkdown(item.text);
    const match = text.match(/^(.*?)(?:\((\d{4}|present|current)\))?$/i);
    const body = (match?.[1] || text).trim();
    const year = (match?.[2] || '').trim();

    return [
      '<div class="edu-item">',
      '  <div class="edu-header">',
      `    <div class="edu-title">${renderInlineMarkdown(body)}</div>`,
      year ? `    <div class="edu-year">${renderInlineMarkdown(year)}</div>` : '',
      '  </div>',
      '</div>',
    ].filter(Boolean).join('\n');
  }).join('\n');
}

function renderSimpleList(items, type) {
  if (items.length === 0) {
    return `<div class="${type === 'certification' ? 'cert-item' : 'edu-item'}"><div class="${type === 'certification' ? 'cert-title' : 'edu-desc'}">No ${type}s section found in cv.md.</div></div>`;
  }

  return items.map((item) => {
    const text = stripMarkdown(item.text);
    return [
      '<div class="cert-item">',
      `  <div class="cert-title">${renderInlineMarkdown(text)}</div>`,
      '</div>',
    ].join('\n');
  }).join('\n');
}

function renderSkills(items) {
  if (items.length === 0) {
    return '<div class="skills-grid"><div class="skill-item">No skills section found in cv.md.</div></div>';
  }

  return [
    '<div class="skills-grid">',
    items.map((item) => {
      if (item.category) {
        return `  <div class="skill-item"><span class="skill-category">${renderInlineMarkdown(item.category)}:</span> ${renderInlineMarkdown(item.text)}</div>`;
      }
      return `  <div class="skill-item">${renderInlineMarkdown(item.text)}</div>`;
    }).join('\n'),
    '</div>',
  ].join('\n');
}

function renderParagraphs(text) {
  if (!String(text || '').trim()) {
    return '';
  }

  return cleanBlockText(String(text).split('\n'))
    .split(/\n{2,}/)
    .map((paragraph) => renderInlineMarkdown(paragraph))
    .join('<br><br>');
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/^[-*]\s+/, '')
    .replace(/^###\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim();
}

function cleanBlockText(lines) {
  return lines
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .join('\n');
}

function firstParagraph(text) {
  const cleaned = cleanBlockText(String(text || '').split('\n'));
  return cleaned.split(/\n{2,}/)[0] || cleaned;
}

function extractKeywords(jobDescription, cvContent, maxKeywords) {
  const candidates = new Map();
  const cvNormalized = normalizeSearchText(cvContent);

  for (const line of jobDescription.replace(/\r\n/g, '\n').split('\n')) {
    const cleanedLine = line.trim();
    if (!cleanedLine) {
      continue;
    }

    const fragments = cleanedLine.split(/[|,;()]/).map((fragment) => fragment.trim()).filter(Boolean);
    for (const fragment of fragments) {
      addKeywordCandidate(candidates, fragment, cvNormalized, 2);
    }

    const tokens = cleanedLine.match(/[A-Za-z][A-Za-z0-9+.#/-]{1,}|[\u3400-\u9FFF]{2,12}/g) || [];
    for (const token of tokens) {
      addKeywordCandidate(candidates, token, cvNormalized, 1);
    }
  }

  const sorted = [...candidates.values()].sort((left, right) => {
    if (right.matched !== left.matched) {
      return Number(right.matched) - Number(left.matched);
    }
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.value.length - right.value.length;
  });

  return {
    matchedKeywords: sorted.filter((entry) => entry.matched).slice(0, maxKeywords).map((entry) => entry.value),
    unusedKeywords: sorted.filter((entry) => !entry.matched).slice(0, maxKeywords).map((entry) => entry.value),
  };
}

function addKeywordCandidate(candidates, rawValue, cvNormalized, baseScore) {
  const value = rawValue.replace(/^[-*]\s+/, '').trim();
  const normalized = normalizeSearchText(value);
  if (!normalized || normalized.length < 2 || normalized.length > 48) {
    return;
  }

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length > 5 || tokens.every((token) => DEFAULT_STOP_WORDS.has(token))) {
    return;
  }

  const matched = phraseMatchesCv(normalized, cvNormalized);
  const score = baseScore + tokens.length + (matched ? 5 : 0);
  const existing = candidates.get(normalized);
  if (existing) {
    existing.score += score;
    existing.matched = existing.matched || matched;
    return;
  }

  candidates.set(normalized, {
    value: prettifyKeyword(value),
    score,
    matched,
  });
}

function phraseMatchesCv(normalizedPhrase, cvNormalized) {
  if (!normalizedPhrase || !cvNormalized) {
    return false;
  }

  if (cvNormalized.includes(normalizedPhrase)) {
    return true;
  }

  const tokens = normalizedPhrase.split(' ').filter(Boolean);
  if (tokens.length === 1) {
    return cvNormalized.includes(tokens[0]);
  }

  return tokens.filter((token) => token.length > 2 && cvNormalized.includes(token)).length >= Math.max(1, tokens.length - 1);
}

function prettifyKeyword(value) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (containsCjk(trimmed)) {
    return trimmed;
  }

  return trimmed.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff+#./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsCjk(value) {
  return /[\u3400-\u9FFF]/.test(String(value || ''));
}

function detectLanguage(cvContent, jobDescription) {
  return containsCjk(cvContent) || containsCjk(jobDescription) ? 'zh' : 'en';
}

function resolveFormat(requestedFormat, jobDescription) {
  if (requestedFormat === 'letter' || requestedFormat === 'a4') {
    return requestedFormat;
  }

  return /\b(united states|usa|u\.s\.|canada|toronto|vancouver|new york|california|remote us)\b/i.test(jobDescription)
    ? 'letter'
    : 'a4';
}

function applyCjkFallback(html) {
  return html
    .replace(/'DM Sans', sans-serif/g, `'DM Sans', ${CJK_FONT_STACK}`)
    .replace(/'Space Grotesk', sans-serif/g, `'Space Grotesk', ${CJK_FONT_STACK}`);
}

async function runPdfGenerator(htmlPath, pdfPath, format) {
  const output = await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [pdfGeneratorPath, htmlPath, pdfPath, `--format=${format}`], {
      cwd: outputDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      const message = `${stderr || stdout || 'Unknown PDF generation error.'}`.trim();
      const error = new Error(message);
      error.statusCode = /(chromium|playwright|browserType\.launch|executable)/i.test(message) ? 503 : 500;
      rejectPromise(error);
    });
  });

  if (/(Playwright chromium not installed|Cannot find package 'playwright'|browserType\.launch|Executable doesn't exist)/i.test(output.stdout + output.stderr)) {
    const error = new Error('Playwright/Chromium is not ready. Run: npm install && npx playwright install chromium');
    error.statusCode = 503;
    throw error;
  }
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}
