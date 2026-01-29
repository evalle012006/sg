// lib/paths.js or utils/paths.js
const path = require('path');

/**
 * Get the base directory for templates based on environment
 * - Docker: /app/templates (set via TEMPLATES_DIR env var)
 * - PM2/Production: Uses process.cwd() or APP_ROOT
 */
const getTemplatesBaseDir = () => {
  if (process.env.TEMPLATES_DIR) {
    return process.env.TEMPLATES_DIR;
  }
  
  if (process.env.APP_ROOT) {
    return path.join(process.env.APP_ROOT, 'templates');
  }
  
  // Fallback to process.cwd()
  return path.join(process.cwd(), 'templates');
};

/**
 * Get the full path to a template file
 * @param {string} relativePath - Path relative to templates directory (e.g., 'exports/summary-of-stay.html')
 * @returns {string} Full absolute path to the template
 */
const getTemplatePath = (relativePath) => {
  const baseDir = getTemplatesBaseDir();
  return path.join(baseDir, relativePath);
};

/**
 * Get the public directory path
 */
const getPublicDir = () => {
  if (process.env.PUBLIC_DIR) {
    return process.env.PUBLIC_DIR;
  }
  return path.join(process.cwd(), 'public');
};

module.exports = {
  getTemplatesBaseDir,
  getTemplatePath,
  getPublicDir,
};