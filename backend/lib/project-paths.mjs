import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = fileURLToPath(new URL('.', import.meta.url));
const defaultRootDir = resolve(moduleDir, '../..');

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
    cvPath: resolveConfiguredPath(rootDir, env.CAREER_OPS_CV_PATH, 'cv.md'),
    profilePath: resolveConfiguredPath(rootDir, env.CAREER_OPS_PROFILE_PATH, 'config/profile.yml'),
    outputDir: resolveConfiguredPath(rootDir, env.CAREER_OPS_OUTPUT_DIR, 'output'),
  };
}

export function toProjectRelativePath(rootDir, filePath) {
  const relativePath = relative(rootDir, filePath);

  if (!relativePath || relativePath.startsWith('..')) {
    return filePath;
  }

  return relativePath;
}
