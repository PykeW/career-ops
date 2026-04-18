import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { getCvDocument, getProfileDocument, readCvFile, readProfileInfo } from './data.mjs';
import { createHttpError } from './http.mjs';
import { outputDir, pdfGeneratorPath, templatePath, toProjectRelativePath } from './project-paths.mjs';

const SECTION_LABELS = {
  en: {
    generatedResume: 'Tailored Resume',
    contact: 'Contact',
    summary: 'Professional Summary',
    competencies: 'Core Competencies',
    experience: 'Work Experience',
    projects: 'Projects',
    education: 'Education',
    certifications: 'Certifications',
    skills: 'Skills',
    metadata: {
      generatedAt: 'Generated At',
      company: 'Target Company',
      role: 'Target Role',
      sourceCv: 'Source CV',
      sourceProfile: 'Source Profile',
      missingProfile: 'Not provided',
      linkedin: 'LinkedIn',
      portfolio: 'Portfolio',
      phone: 'Phone',
      email: 'Email',
      location: 'Location',
      focus: 'Relevant focus areas from the source CV',
    },
  },
  zh: {
    generatedResume: '定制简历',
    contact: '联系方式',
    summary: '职业简介',
    competencies: '核心能力',
    experience: '工作经历',
    projects: '项目经验',
    education: '教育经历',
    certifications: '证书',
    skills: '技能',
    metadata: {
      generatedAt: '生成时间',
      company: '目标公司',
      role: '目标岗位',
      sourceCv: '来源 CV',
      sourceProfile: '来源 Profile',
      missingProfile: '未提供',
      linkedin: 'LinkedIn',
      portfolio: '作品集',
      phone: '电话',
      email: '邮箱',
      location: '所在地',
      focus: '基于原始 CV 的重点方向',
    },
  },
};

const SECTION_ALIASES = {
  summary: ['professional summary', 'summary', 'profile', 'about', 'resumen profesional', '职业简介', '个人简介'],
  experience: ['work experience', 'experience', 'employment', 'professional experience', 'recent engineering', '工作经历', '经历'],
  projects: ['projects', 'selected projects', 'personal projects', 'project experience', '项目', '项目经验'],
  education: ['education', 'academic background', 'formation', '教育', '教育经历'],
  certifications: ['certifications', 'certificates', 'licenses', '证书', '认证'],
  skills: ['skills', 'technical skills', 'competencies', 'core competencies', 'tooling', '技能', '核心能力'],
};

const DEFAULT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'have', 'in', 'into', 'is', 'it', 'of', 'on',
  'or', 'our', 'that', 'the', 'their', 'this', 'to', 'will', 'with', 'you', 'your', 'we', 'who', 'about', 'across',
  'after', 'all', 'also', 'any', 'can', 'do', 'does', 'each', 'every', 'help', 'helps', 'if', 'job', 'join',
  'looking', 'make', 'more', 'must', 'need', 'needed', 'needs', 'new', 'not', 'one', 'role', 'team', 'teams',
  'using', 'work', 'working', 'years', 'year', 'plus', 'preferred', 'including', 'such', 'than', 'them', 'these',
  'those', 'through', 'while', 'where', 'which', 'within', 'would', 'should', 'skills', 'skill', 'requirements',
]);

const HEADER_LABELS = {
  location: ['Location', '所在地', '位置'],
  email: ['Email', '邮箱', '电子邮箱'],
  linkedin: ['LinkedIn'],
  portfolio: ['Portfolio', '作品集'],
  github: ['GitHub'],
  phone: ['Phone', '电话', '手机', '手機'],
};

const JD_STOPWORDS = new Set([
  'able',
  'about',
  'across',
  'also',
  'and',
  'are',
  'can',
  'company',
  'deliver',
  'for',
  'from',
  'have',
  'ideal',
  'into',
  'join',
  'looking',
  'must',
  'our',
  'role',
  'should',
  'someone',
  'strong',
  'team',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'using',
  'who',
  'will',
  'with',
  'work',
  'you',
  'your',
]);

const CJK_FONT_STACK = "'Noto Sans CJK SC', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans GB', 'Heiti SC', 'WenQuanYi Micro Hei', sans-serif";

let templateCache;

export async function generateTailoredResume(input = {}) {
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
  const profileCandidate = profile.candidate || {};
  const parsedCv = parseCvMarkdown(cvState.content);
  const format = resolveFormat(input.format, jobDescription);
  const lang = detectLanguage(cvState.content, jobDescription);
  const labels = SECTION_LABELS[lang] || SECTION_LABELS.en;
  const keywordResult = extractKeywords(jobDescription, cvState.content, 12);
  const usedKeywords = keywordResult.matchedKeywords.slice(0, 8);
  const notes = Array.isArray(profile.notes) ? [...profile.notes] : [];

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
  const candidateSlug = slugify(profileCandidate.fullName || profileCandidate.full_name || parsedCv.name || 'candidate');
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
  const profileCandidate = input.profile.candidate || {};
  const linkedinValue = profileCandidate.linkedinUrl || profileCandidate.linkedin_url || profileCandidate.linkedin || '';
  const portfolioValue = profileCandidate.portfolioUrl || profileCandidate.portfolio_url || profileCandidate.portfolio || '';
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
    '{{NAME}}': escapeHtml(profileCandidate.fullName || profileCandidate.full_name || input.parsedCv.name || 'Candidate'),
    '{{EMAIL}}': escapeHtml(profileCandidate.email || ''),
    '{{LINKEDIN_URL}}': escapeHtml(linkedinValue ? ensureUrlProtocol(linkedinValue) : '#'),
    '{{LINKEDIN_DISPLAY}}': escapeHtml(profileCandidate.linkedin || linkedinValue || ''),
    '{{PORTFOLIO_URL}}': escapeHtml(portfolioValue ? ensureUrlProtocol(portfolioValue) : '#'),
    '{{PORTFOLIO_DISPLAY}}': escapeHtml(profileCandidate.portfolioDisplay || profileCandidate.portfolio || portfolioValue || ''),
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
    summaryText: cleanBlockText((findSectionByKey(sections, 'summary') || {}).lines || []),
    experiences: parseRankedExperienceSection((findSectionByKey(sections, 'experience') || {}).lines || []),
    projects: parseProjectSection((findSectionByKey(sections, 'projects') || {}).lines || []),
    education: parseSimpleSection((findSectionByKey(sections, 'education') || {}).lines || []),
    certifications: parseSimpleSection((findSectionByKey(sections, 'certifications') || {}).lines || []),
    skills: parseSkillSection((findSectionByKey(sections, 'skills') || {}).lines || []),
  };
}

function findSectionByKey(sections, key) {
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

function extractName(source) {
  const heading = Array.isArray(source)
    ? source.find((line) => /^#\s+/.test(String(line || '').trim()))
    : String(source || '');

  if (!heading) {
    return '';
  }

  return String(heading)
    .replace(/^#\s+/, '')
    .replace(/^(cv|resume|curriculum vitae)\s*(?:--|[-:：]+)\s*/i, '')
    .replace(/^简历\s*(?:--|[-:：]+)\s*/i, '')
    .trim();
}

function parseRankedExperienceSection(lines) {
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
      .map((line, lineIndex) => ({ line, lineIndex }))
      .filter(({ line }) => !/^[-*]\s+/.test(line))
      .filter(({ lineIndex }) => lineIndex !== roleIndex)
      .map(({ line }) => line)
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
    .replace(/^_(.+)_$/, '$1')
    .replace(/^\*(.+)\*$/, '$1')
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

function detectLanguage(...values) {
  return values.some((value) => containsCjk(value)) ? 'zh' : 'en';
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

function slugify(value, fallback = 'resume') {
  const ascii = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return ascii || fallback;
}

function stripMarkdownDecoration(text) {
  return String(text || '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)');
}

function getSectionLabels(language) {
  return SECTION_LABELS[language] || SECTION_LABELS.en;
}

function extractHeaderValue(lines, labels) {
  for (const label of labels) {
    const regex = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`, 'i');
    const match = lines.find((line) => regex.test(line.trim()));

    if (match) {
      return match.replace(regex, '$1').trim();
    }
  }

  return '';
}

function sectionNameMatches(line, candidates) {
  const normalized = line.trim().replace(/^#+\s*/, '').toLowerCase();
  return candidates.some((candidate) => normalized === candidate.toLowerCase());
}

function splitSections(lines) {
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);

    if (headingMatch) {
      currentSection = {
        title: headingMatch[1].trim(),
        lines: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  return sections;
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function summarizeText(lines) {
  const text = normalizeWhitespace(lines.join(' '));
  if (!text) {
    return '';
  }

  const sentences = text.split(/(?<=[.!?。！？])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(' ').slice(0, 420).trim();
}

function parseMarkdownExperienceSection(lines) {
  const jobs = [];
  let currentJob = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      if (currentJob) {
        jobs.push(currentJob);
      }

      const [company, location = ''] = headingMatch[1].split(/\s+--\s+/);
      currentJob = {
        company: company.trim(),
        location: location.trim(),
        role: '',
        period: '',
        bullets: [],
      };
      continue;
    }

    if (!currentJob) {
      continue;
    }

    if (!currentJob.role && /^\*\*(.+)\*\*$/.test(line)) {
      currentJob.role = line.replace(/^\*\*(.+)\*\*$/, '$1').trim();
      continue;
    }

    const periodText = findPeriodLine([line]);
    if (!currentJob.period && periodText) {
      currentJob.period = periodText;
      continue;
    }

    if (!currentJob.role && isPlainTextLine(line)) {
      currentJob.role = stripMarkdown(line);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      currentJob.bullets.push(line.replace(/^[-*]\s+/, '').trim());
    }
  }

  if (currentJob) {
    jobs.push(currentJob);
  }

  return jobs;
}

function parseSimpleItems(lines) {
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !/^###+\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim());
}

function parseMarkdownSkills(items) {
  return items.map((item) => {
    const categoryMatch = item.match(/^\*\*(.+?)\*\*:\s*(.+)$/);

    if (categoryMatch) {
      return {
        category: categoryMatch[1].trim(),
        value: categoryMatch[2].trim(),
      };
    }

    return {
      category: '',
      value: item,
    };
  });
}

function extractTerms(text) {
  return String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}+.#/-]{2,}/gu) || [];
}

function pickTopKeywords(jobDescription, cvContent = '') {
  const jobTerms = extractTerms(jobDescription);
  const cvTerms = new Set(extractTerms(cvContent).map((term) => term.toLowerCase()));
  const frequency = new Map();

  for (const term of jobTerms) {
    const key = term.toLowerCase();
    if (key.length < 3 || JD_STOPWORDS.has(key) || !cvTerms.has(key)) {
      continue;
    }

    frequency.set(key, (frequency.get(key) || 0) + 1);
  }

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([keyword]) => keyword)
    .map((keyword) => /^[a-z]/.test(keyword)
      ? keyword.replace(/^[a-z]/, (char) => char.toUpperCase())
      : keyword);
}

function pickFallbackCompetencies(parsedCv) {
  const candidates = [];

  for (const item of parsedCv.skills) {
    if (item.category) {
      candidates.push(item.category);
    }

    candidates.push(
      ...String(item.value || '')
        .split(/[,/;]+/)
        .map((value) => normalizeWhitespace(stripMarkdownDecoration(value)))
        .filter(Boolean),
    );
  }

  for (const job of parsedCv.experience) {
    if (job.role) {
      candidates.push(job.role);
    }
  }

  const deduped = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const normalized = candidate.trim();
    const key = normalized.toLowerCase();

    if (!normalized || normalized.length > 48 || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(normalized);

    if (deduped.length === 8) {
      break;
    }
  }

  return deduped;
}

function scoreBulletForJobDescription(bullet, lowerJobDescription) {
  const words = extractTerms(bullet).map((word) => word.toLowerCase());
  let score = 0;

  for (const word of words) {
    if (lowerJobDescription.includes(word)) {
      score += 1;
    }
  }

  return score;
}

function reorderBullets(bullets, jobDescription) {
  const lowerJobDescription = jobDescription.toLowerCase();

  return [...bullets].sort((left, right) => {
    const scoreDifference = scoreBulletForJobDescription(right, lowerJobDescription)
      - scoreBulletForJobDescription(left, lowerJobDescription);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return 0;
  });
}

function findSectionByNames(sections, names) {
  return sections.find((section) => sectionNameMatches(section.title, names));
}

function parseProjectItemsForMarkdownResume(lines) {
  const projectItems = parseProjectSection(lines);

  if (projectItems.length > 0) {
    return projectItems
      .map((item) => normalizeWhitespace([
        item.title,
        item.badge ? `(${item.badge})` : '',
        item.description,
        item.tech,
      ].filter(Boolean).join(' - ')))
      .filter(Boolean);
  }

  return parseSimpleItems(lines);
}

function parseCv(content) {
  const normalized = String(content || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const sections = splitSections(lines);

  const summarySection = findSectionByNames(sections, ['Professional Summary', 'Summary', '职业简介', '个人简介']);
  const experienceSection = findSectionByNames(sections, ['Work Experience', 'Experience', '工作经历', '经历']);
  const projectsSection = findSectionByNames(sections, ['Projects', 'Project Experience', '项目', '项目经验']);
  const educationSection = findSectionByNames(sections, ['Education', '教育', '教育经历']);
  const certificationsSection = findSectionByNames(sections, ['Certifications', 'Certificates', '证书', '认证']);
  const skillsSection = findSectionByNames(sections, ['Skills', '技能']);

  return {
    header: {
      name: extractName(lines[0]),
      location: extractHeaderValue(lines, HEADER_LABELS.location),
      email: extractHeaderValue(lines, HEADER_LABELS.email),
      linkedin: extractHeaderValue(lines, HEADER_LABELS.linkedin),
      portfolio: extractHeaderValue(lines, HEADER_LABELS.portfolio),
      github: extractHeaderValue(lines, HEADER_LABELS.github),
      phone: extractHeaderValue(lines, HEADER_LABELS.phone),
    },
    summary: summarySection ? summarizeText(summarySection.lines) : '',
    experience: experienceSection ? parseMarkdownExperienceSection(experienceSection.lines) : [],
    projects: projectsSection ? parseProjectItemsForMarkdownResume(projectsSection.lines) : [],
    education: educationSection ? parseSimpleItems(educationSection.lines) : [],
    certifications: certificationsSection ? parseSimpleItems(certificationsSection.lines) : [],
    skills: skillsSection ? parseMarkdownSkills(parseSimpleItems(skillsSection.lines)) : [],
  };
}

function inferContactValue(primaryValue, fallbackValue) {
  return primaryValue || fallbackValue || '';
}

function ensureUrlProtocol(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function inferProfileFields(profile, parsedCv) {
  const candidate = profile?.candidate || {};
  const location = candidate.location || parsedCv.header.location || '';
  const linkedinValue = candidate.linkedin || candidate.linkedinUrl || parsedCv.header.linkedin || '';
  const portfolioValue = candidate.portfolio_url || candidate.portfolioUrl || candidate.portfolio || parsedCv.header.portfolio || '';

  return {
    fullName: candidate.full_name || candidate.fullName || parsedCv.header.name || 'Candidate',
    email: inferContactValue(candidate.email, parsedCv.header.email),
    phone: inferContactValue(candidate.phone, parsedCv.header.phone),
    location,
    linkedinUrl: linkedinValue ? ensureUrlProtocol(linkedinValue) : '',
    linkedinDisplay: linkedinValue,
    portfolioUrl: portfolioValue ? ensureUrlProtocol(portfolioValue) : '',
    portfolioDisplay: portfolioValue,
  };
}

function buildSummaryText(parsedCv, competencyKeywords, labels) {
  const existingSummary = parsedCv.summary;

  if (existingSummary) {
    if (!competencyKeywords.length) {
      return existingSummary;
    }

    return normalizeWhitespace(
      `${existingSummary} ${labels.metadata.focus}: ${competencyKeywords.join(', ')}.`
    );
  }

  const fallbackSummary = parsedCv.experience
    .flatMap((job) => job.bullets)
    .slice(0, 2)
    .map((bullet) => stripMarkdownDecoration(bullet))
    .join(' ')
    .trim();

  return fallbackSummary || competencyKeywords.join(', ');
}

function renderBulletList(items) {
  return items.length
    ? items.map((item) => `- ${stripMarkdownDecoration(item)}`)
    : ['- N/A'];
}

function renderExperienceMarkdown(jobs, jobDescription) {
  if (!jobs.length) {
    return ['No experience entries found in cv.md'];
  }

  return jobs.flatMap((job) => {
    const lines = [];
    lines.push(`### ${job.company}${job.location ? ` -- ${job.location}` : ''}`);

    if (job.role) {
      lines.push(`**${job.role}**`);
    }
    if (job.period) {
      lines.push(`_${job.period}_`);
    }

    lines.push(...renderBulletList(reorderBullets(job.bullets, jobDescription)));
    lines.push('');
    return lines;
  }).slice(0, -1);
}

function renderProjectsMarkdown(items) {
  return renderBulletList(items);
}

function renderEducationMarkdown(items) {
  return renderBulletList(items);
}

function renderCertificationsMarkdown(items) {
  return renderBulletList(items);
}

function renderSkillsMarkdown(items) {
  if (!items.length) {
    return ['- N/A'];
  }

  return items.map((item) => {
    if (!item.category) {
      return `- ${stripMarkdownDecoration(item.value)}`;
    }

    return `- ${item.category}: ${stripMarkdownDecoration(item.value)}`;
  });
}

function renderContactLines(profileFields, labels) {
  const lines = [];

  if (profileFields.email) {
    lines.push(`- ${labels.metadata.email}: ${profileFields.email}`);
  }
  if (profileFields.phone) {
    lines.push(`- ${labels.metadata.phone}: ${profileFields.phone}`);
  }
  if (profileFields.location) {
    lines.push(`- ${labels.metadata.location}: ${profileFields.location}`);
  }
  if (profileFields.linkedinDisplay) {
    lines.push(`- ${labels.metadata.linkedin}: ${profileFields.linkedinDisplay}`);
  }
  if (profileFields.portfolioDisplay) {
    lines.push(`- ${labels.metadata.portfolio}: ${profileFields.portfolioDisplay}`);
  }

  return lines;
}

function buildMarkdownResume({ parsedCv, profileFields, jobDescription, language, keywords, metadata }) {
  const labels = getSectionLabels(language);
  const summaryText = buildSummaryText(parsedCv, keywords, labels);
  const lines = [];

  lines.push(`# ${labels.generatedResume} -- ${profileFields.fullName}`);
  lines.push('');
  lines.push(`- ${labels.metadata.generatedAt}: ${metadata.generatedAt}`);
  if (metadata.company) {
    lines.push(`- ${labels.metadata.company}: ${metadata.company}`);
  }
  if (metadata.targetRole) {
    lines.push(`- ${labels.metadata.role}: ${metadata.targetRole}`);
  }
  lines.push(`- ${labels.metadata.sourceCv}: ${metadata.sourceCvPath}`);
  lines.push(`- ${labels.metadata.sourceProfile}: ${metadata.sourceProfilePath || labels.metadata.missingProfile}`);
  lines.push('');

  const contactLines = renderContactLines(profileFields, labels);
  if (contactLines.length) {
    lines.push(`## ${labels.contact}`);
    lines.push('');
    lines.push(...contactLines);
    lines.push('');
  }

  lines.push(`## ${labels.summary}`);
  lines.push('');
  lines.push(summaryText || 'N/A');
  lines.push('');

  lines.push(`## ${labels.competencies}`);
  lines.push('');
  lines.push(...renderBulletList(keywords));
  lines.push('');

  lines.push(`## ${labels.experience}`);
  lines.push('');
  lines.push(...renderExperienceMarkdown(parsedCv.experience, jobDescription));
  lines.push('');

  if (parsedCv.projects.length) {
    lines.push(`## ${labels.projects}`);
    lines.push('');
    lines.push(...renderProjectsMarkdown(parsedCv.projects));
    lines.push('');
  }

  if (parsedCv.education.length) {
    lines.push(`## ${labels.education}`);
    lines.push('');
    lines.push(...renderEducationMarkdown(parsedCv.education));
    lines.push('');
  }

  if (parsedCv.certifications.length) {
    lines.push(`## ${labels.certifications}`);
    lines.push('');
    lines.push(...renderCertificationsMarkdown(parsedCv.certifications));
    lines.push('');
  }

  lines.push(`## ${labels.skills}`);
  lines.push('');
  lines.push(...renderSkillsMarkdown(parsedCv.skills));
  lines.push('');

  return `${lines.join('\n').trim()}\n`;
}

export async function generateResume(paths, payload = {}) {
  const jobDescription = typeof payload.jobDescription === 'string'
    ? payload.jobDescription.trim()
    : typeof payload.jdText === 'string'
      ? payload.jdText.trim()
      : '';

  if (!jobDescription) {
    throw createHttpError(400, 'Request body field `jobDescription` is required');
  }

  const [cvDocument, profileDocument] = await Promise.all([
    getCvDocument(paths),
    getProfileDocument(paths),
  ]);

  if (!cvDocument.exists) {
    throw createHttpError(404, `CV file not found at ${cvDocument.path}`);
  }

  const parsedCv = parseCv(cvDocument.content);
  const language = detectLanguage(cvDocument.content, jobDescription);
  const profileFields = inferProfileFields(profileDocument.profile, parsedCv);
  const keywords = pickTopKeywords(jobDescription, cvDocument.content);
  const competencyKeywords = keywords.length ? keywords : pickFallbackCompetencies(parsedCv);
  const generatedAt = new Date().toISOString();
  const timestampSlug = generatedAt.replace(/[:.]/g, '-');
  const candidateSlug = slugify(profileFields.fullName, 'candidate');
  const resumeSlug = slugify(
    payload.company || payload.targetRole || competencyKeywords[0] || 'target-role',
    'target-role'
  );

  const resumeContent = buildMarkdownResume({
    parsedCv,
    profileFields,
    jobDescription,
    language,
    keywords: competencyKeywords,
    metadata: {
      generatedAt,
      company: payload.company || payload.companyName || '',
      targetRole: payload.targetRole || payload.role || '',
      sourceCvPath: cvDocument.path,
      sourceProfilePath: profileDocument.exists ? profileDocument.path : '',
    },
  });

  await mkdir(paths.outputDir, { recursive: true });

  const fileName = `resume-${candidateSlug}-${resumeSlug}-${timestampSlug}.md`;
  const outputPath = join(paths.outputDir, fileName);
  await writeFile(outputPath, resumeContent, 'utf8');

  return {
    ok: true,
    artifactType: 'markdown',
    contentType: 'text/markdown; charset=utf-8',
    language,
    fileName: basename(outputPath),
    downloadPath: `/api/resume/download/${encodeURIComponent(basename(outputPath))}`,
    outputPath: toProjectRelativePath(paths.rootDir, outputPath),
    content: resumeContent,
    keywords: competencyKeywords,
    sourceCvPath: cvDocument.path,
    sourceProfilePath: profileDocument.exists ? profileDocument.path : null,
    generatedAt,
  };
}