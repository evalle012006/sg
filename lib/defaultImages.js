// Default placeholder SVG images for different types
export const DEFAULT_IMAGES = {
  // Service placeholder - person icon with gradient background
  service: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Cdefs%3E%3ClinearGradient id="serviceBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%2310b981;stop-opacity:0.2" /%3E%3Cstop offset="100%25" style="stop-color:%233b82f6;stop-opacity:0.2" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23serviceBg)" width="200" height="200"/%3E%3Cg transform="translate(100, 100)"%3E%3Ccircle fill="%239ca3af" cx="0" cy="-15" r="25"/%3E%3Cpath fill="%239ca3af" d="M-35 20 Q-35 -5 0 -5 Q35 -5 35 20 L35 40 L-35 40 Z"/%3E%3C/g%3E%3C/svg%3E',
  
  // Equipment placeholder - box/package icon with gradient
  equipment: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Cdefs%3E%3ClinearGradient id="equipBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%236366f1;stop-opacity:0.2" /%3E%3Cstop offset="100%25" style="stop-color:%23ec4899;stop-opacity:0.2" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23equipBg)" width="200" height="200"/%3E%3Cg transform="translate(100, 100)"%3E%3Cpath fill="%239ca3af" d="M-40 -20 L0 -40 L40 -20 L40 30 L0 50 L-40 30 Z" opacity="0.6"/%3E%3Cpath fill="%236b7280" d="M-40 -20 L0 0 L0 50 L-40 30 Z"/%3E%3Cpath fill="%239ca3af" d="M40 -20 L0 0 L0 50 L40 30 Z"/%3E%3Cpath fill="%234b5563" d="M-40 -20 L0 -40 L0 0 L-40 -20 Z"/%3E%3Cpath fill="%236b7280" d="M40 -20 L0 -40 L0 0 L40 -20 Z"/%3E%3C/g%3E%3C/svg%3E',
  
  // Sub-option placeholder - checkmark icon with gradient
  subOption: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Cdefs%3E%3ClinearGradient id="subBg" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%2314b8a6;stop-opacity:0.2" /%3E%3Cstop offset="100%25" style="stop-color:%23f59e0b;stop-opacity:0.2" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23subBg)" width="200" height="200"/%3E%3Cg transform="translate(100, 100)"%3E%3Ccircle fill="none" stroke="%239ca3af" stroke-width="8" r="50"/%3E%3Cpath fill="none" stroke="%239ca3af" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" d="M-20 0 L-5 15 L25 -25"/%3E%3C/g%3E%3C/svg%3E'
};

// Get appropriate default image
export const getDefaultImage = (type = 'service') => {
  return DEFAULT_IMAGES[type] || DEFAULT_IMAGES.service;
};