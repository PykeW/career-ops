import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const libDir = dirname(fileURLToPath(import.meta.url));

const webDir = dirname(libDir);
const projectRoot = dirname(webDir);
const configDir = join(projectRoot, 'config');

export const cvPath = join(projectRoot, 'cv.md');
export const profilePath = join(configDir, 'profile.yml');
