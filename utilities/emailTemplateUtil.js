/**
 * Email Template Utility Functions
 * Used by EmailTemplateBuilder for template normalization and variable extraction
 */

/**
 * Normalize all merge tags to underscore format (snake_case)
 * Converts both hyphenated and camelCase tags
 * 
 * @param {string} html - HTML content with merge tags
 * @returns {string} - Normalized HTML
 */
export function normalizeTemplateTags(html) {
  if (!html) return html;
  
  console.log('🔄 Normalizing template tags to underscore format...');
  
  let normalized = html;
  let conversionCount = 0;
  
  // Step 1: Convert hyphenated tags (my-tag-name → my_tag_name)
  normalized = normalized.replace(
    /\{\{([#/]?)([a-zA-Z][\w-]*?)(\s|[^}]*)?\}\}/g,
    (match, prefix, tagName, suffix) => {
      if (tagName.includes('-')) {
        const converted = tagName.replace(/-/g, '_');
        conversionCount++;
        console.log(`  ✓ ${tagName} → ${converted}`);
        return `{{${prefix}${converted}${suffix || ''}}}`;
      }
      return match;
    }
  );
  
  // Step 2: Convert camelCase tags (myTagName → my_tag_name)
  normalized = normalized.replace(
    /\{\{([#/]?)([a-z][a-zA-Z0-9]*?)(\s|[^}]*)?\}\}/g,
    (match, prefix, tagName, suffix) => {
      // Check if tag contains uppercase letters (camelCase)
      if (/[A-Z]/.test(tagName)) {
        // Convert camelCase to snake_case
        const converted = tagName
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, ''); // Remove leading underscore
        
        conversionCount++;
        console.log(`  ✓ ${tagName} → ${converted}`);
        return `{{${prefix}${converted}${suffix || ''}}}`;
      }
      return match;
    }
  );
  
  if (conversionCount > 0) {
    console.log(`✅ Normalized ${conversionCount} tag(s) to underscore format`);
  } else {
    console.log(`✓ No tags needed normalization`);
  }
  
  return normalized;
}

/**
 * Extract all unique variable names from template
 * Returns array of variable names (without {{ }} and prefixes)
 * 
 * @param {string} html - HTML content with merge tags
 * @returns {string[]} - Array of unique variable names
 */
export function extractTemplateVariables(html) {
  if (!html) return [];
  
  const variables = new Set();
  
  // Match all Handlebars expressions
  const pattern = /\{\{([#/]?)([a-zA-Z_][\w]*?)(\s|[^}]*)?\}\}/g;
  let match;
  
  while ((match = pattern.exec(html)) !== null) {
    const prefix = match[1];
    const tagName = match[2];
    
    // Skip helper prefixes and closing tags
    if (prefix === '/' || prefix === '#') continue;
    
    // Skip Handlebars helpers (if, each, unless, with)
    if (['if', 'each', 'unless', 'with', 'isNotEmpty'].includes(tagName)) continue;
    
    variables.add(tagName);
  }
  
  const variableArray = Array.from(variables).sort();
  console.log(`📋 Template uses ${variableArray.length} variable(s):`, variableArray);
  
  return variableArray;
}

/**
 * Validate template for deprecated hyphenated tags
 * 
 * @param {string} html - HTML content to validate
 * @returns {object} - Validation result with issues and tag list
 */
export function validateTemplateForHyphenatedTags(html) {
  const hyphenatedTagPattern = /\{\{(?!\[)[#/]?(\w+(?:-\w+)+)[^}]*\}\}/g;
  const matches = [];
  let match;

  while ((match = hyphenatedTagPattern.exec(html)) !== null) {
    matches.push(match[1]);
  }

  return {
    hasIssues: matches.length > 0,
    hyphenatedTags: [...new Set(matches)],
    count: matches.length
  };
}