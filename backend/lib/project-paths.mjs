import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = fileURLToPath(new URL('.', import.meta.url));

export const backendDir = resolve(moduleDir, '..');
export const projectRoot = resolve(moduleDir, '../..');
const defaultRootDir = projectRoot;

export const outputDir = resolve(projectRoot, 'output');
export const fontsDir = resolve(projectRoot, 'fonts');
export const configDir = resolve(projectRoot, 'config');
export const cvPath = resolve(projectRoot, 'cv.md');
export const profilePath = resolve(configDir, 'profile.yml');
export const templatePath = resolve(projectRoot, 'templates', 'cv-template.html');
export const pdfGeneratorPath = resolve(projectRoot, 'generate-pdf.mjs');

function resolveConfiguredPath(rootDir, configuredPath, fallbackRelativePath) {
  if (!configuredPath) {
    return resolve(rootDir, fallbackRelativePath);
  }

  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(rootDir, configuredPath);
}

export function getProjectPaths(env = process.env) {
  const rootDir = env.CAREER_OPS_ROOT_DIR
    ? resolve(env.CAREER_OPS_ROOT_DIR)
    : defaultRootDir;

  return {
    rootDir,
    projectRoot: rootDir,
    backendDir: resolve(rootDir, 'backend'),
    configDir: resolve(rootDir, 'config'),
    outputDir: resolveConfiguredPath(rootDir, env.CAREER_OPS_OUTPUT_DIR, 'output'),
    fontsDir: resolve(rootDir, 'fonts'),
    cvPath: resolveConfiguredPath(rootDir, env.CAREER_OPS_CV_PATH, 'cv.md'),
    profilePath: resolveConfiguredPath(rootDir, env.CAREER_OPS_PROFILE_PATH, 'config/profile.yml'),
    templatePath: resolve(rootDir, 'templates', 'cv-template.html'),
    pdfGeneratorPath: resolve(rootDir, 'generate-pdf.mjs'),
  };
}

export function toProjectRelativePath(rootDir, filePath) {
  const relativePath = relative(rootDir, filePath);

  if (!relativePath || relativePath.startsWith('..')) {
    return filePath;
  }

  return relativePath;
}