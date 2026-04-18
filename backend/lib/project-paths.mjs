import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const libDir = dirname(fileURLToPath(import.meta.url));

export const backendDir = dirname(libDir);
export const projectRoot = dirname(backendDir);
export const outputDir = join(projectRoot, 'output');
export const fontsDir = join(projectRoot, 'fonts');
export const configDir = join(projectRoot, 'config');
export const cvPath = join(projectRoot, 'cv.md');
export const profilePath = join(configDir, 'profile.yml');
export const templatePath = join(projectRoot, 'templates', 'cv-template.html');
export const pdfGeneratorPath = join(projectRoot, 'generate-pdf.mjs');
