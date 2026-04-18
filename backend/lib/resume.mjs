import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { getCvDocument, getProfileDocument } from './data.mjs';
import { createHttpError } from './http.mjs';
import { toProjectRelativePath } from './project-paths.mjs';

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

function detectLanguage(content) {
  return /[\u3400-\u9fff]/.test(content) ? 'zh' : 'en';
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

function extractName(firstLine) {
  return String(firstLine || '')
    .replace(/^#\s*/, '')
    .replace(/^CV\s*--\s*/i, '')
    .replace(/^CV\s*[:：]\s*/i, '')
    .replace(/^简历\s*[:：]\s*/i, '')
    .trim();
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

function parseExperienceSection(lines) {
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

    if (!currentJob.period && /^\d{4}(?:\s*[-–]\s*\d{4}|\s*[-–]\s*present)?$/i.test(line)) {
      currentJob.period = line;
      continue;
    }

    if (/^-\s+/.test(line)) {
      currentJob.bullets.push(line.replace(/^-\s+/, '').trim());
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
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, '').trim());
}

function parseSkills(items) {
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
        .filter(Boolean)
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

function findSection(sections, names) {
  return sections.find((section) => sectionNameMatches(section.title, names));
}

function parseCv(content) {
  const normalized = String(content || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const sections = splitSections(lines);

  const summarySection = findSection(sections, ['Professional Summary', 'Summary', '职业简介', '个人简介']);
  const experienceSection = findSection(sections, ['Work Experience', 'Experience', '工作经历', '经历']);
  const projectsSection = findSection(sections, ['Projects', 'Project Experience', '项目', '项目经验']);
  const educationSection = findSection(sections, ['Education', '教育', '教育经历']);
  const certificationsSection = findSection(sections, ['Certifications', 'Certificates', '证书', '认证']);
  const skillsSection = findSection(sections, ['Skills', '技能']);

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
    experience: experienceSection ? parseExperienceSection(experienceSection.lines) : [],
    projects: projectsSection ? parseSimpleItems(projectsSection.lines) : [],
    education: educationSection ? parseSimpleItems(educationSection.lines) : [],
    certifications: certificationsSection ? parseSimpleItems(certificationsSection.lines) : [],
    skills: skillsSection ? parseSkills(parseSimpleItems(skillsSection.lines)) : [],
  };
}

function inferContactValue(primaryValue, fallbackValue) {
  return primaryValue || fallbackValue || '';
}

function inferProfileFields(profile, parsedCv) {
  const candidate = profile?.candidate || {};
  const location = candidate.location || parsedCv.header.location || '';

  return {
    fullName: candidate.full_name || parsedCv.header.name || 'Candidate',
    email: inferContactValue(candidate.email, parsedCv.header.email),
    phone: inferContactValue(candidate.phone, parsedCv.header.phone),
    location,
    linkedinUrl: candidate.linkedin
      ? candidate.linkedin.startsWith('http')
        ? candidate.linkedin
        : `https://${candidate.linkedin}`
      : parsedCv.header.linkedin
        ? `https://${parsedCv.header.linkedin}`
        : '',
    linkedinDisplay: candidate.linkedin || parsedCv.header.linkedin || '',
    portfolioUrl: candidate.portfolio_url || parsedCv.header.portfolio || '',
    portfolioDisplay: candidate.portfolio_url || parsedCv.header.portfolio || '',
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
  const language = detectLanguage(cvDocument.content);
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
