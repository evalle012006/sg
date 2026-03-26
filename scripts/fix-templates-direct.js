/**
 * DIRECT DATABASE FIX
 * Normalizes templates directly in database, bypassing UI
 * 
 * Usage: node scripts/fix-templates-direct.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { EmailTemplate } = require('../models');

/**
 * Normalize tags to underscore format
 */
function normalizeTemplateTags(html) {
  if (!html) return html;
  
  let normalized = html;
  
  // Convert hyphenated tags
  normalized = normalized.replace(
    /\{\{([#/]?)([a-zA-Z][\w-]*?)(\s|[^}]*)?\}\}/g,
    (match, prefix, tagName, suffix) => {
      if (tagName.includes('-')) {
        const converted = tagName.replace(/-/g, '_');
        return `{{${prefix}${converted}${suffix || ''}}}`;
      }
      return match;
    }
  );
  
  // Convert camelCase tags
  normalized = normalized.replace(
    /\{\{([#/]?)([a-z][a-zA-Z0-9]*?)(\s|[^}]*)?\}\}/g,
    (match, prefix, tagName, suffix) => {
      if (/[A-Z]/.test(tagName)) {
        const converted = tagName
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '');
        return `{{${prefix}${converted}${suffix || ''}}}`;
      }
      return match;
    }
  );
  
  return normalized;
}

/**
 * Extract variables from template
 */
function extractTemplateVariables(html) {
  if (!html) return [];
  
  const variables = new Set();
  const pattern = /\{\{([#/]?)([a-zA-Z_][\w]*?)(\s|[^}]*)?\}\}/g;
  let match;
  
  while ((match = pattern.exec(html)) !== null) {
    const prefix = match[1];
    const tagName = match[2];
    
    if (prefix === '/' || prefix === '#') continue;
    if (['if', 'each', 'unless', 'with', 'isNotEmpty'].includes(tagName)) continue;
    
    variables.add(tagName);
  }
  
  return Array.from(variables).sort();
}

/**
 * Main function
 */
async function fixTemplates() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        DIRECT DATABASE FIX - Normalize Templates           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Fetch templates that need fixing (templates 19 and 20)
    const templatesToFix = await EmailTemplate.findAll({
      where: {
        id: [19, 20]
      }
    });

    console.log(`Found ${templatesToFix.length} templates to fix\n`);

    for (const template of templatesToFix) {
      console.log(`\n📝 Processing: ${template.name} (ID: ${template.id})`);
      console.log(`   Current html_content length: ${template.html_content?.length || 0}`);

      // Normalize the HTML
      const normalizedHtml = normalizeTemplateTags(template.html_content);
      
      // Extract variables
      const variables = extractTemplateVariables(normalizedHtml);
      
      console.log(`   Variables found: ${variables.join(', ')}`);

      // Count changes
      const hadCamelCase = template.html_content.includes('{{arrivalDate}}') || 
                          template.html_content.includes('{{departureDate}}') ||
                          template.html_content.includes('{{accommodation}}');

      if (hadCamelCase) {
        console.log(`   🔄 Found camelCase tags - normalizing...`);
        
        // Update the template
        await template.update({
          html_content: normalizedHtml,
          required_variables: variables,
          json_design: {
            ...template.json_design,
            html: normalizedHtml,
            variables: variables
          }
        });

        console.log(`   ✅ Updated successfully!`);
        console.log(`   📋 Stored variables: ${variables.length}`);
        
        // Verify
        const hasArrivalDate = normalizedHtml.includes('{{arrival_date}}');
        const hasDepartureDate = normalizedHtml.includes('{{departure_date}}');
        
        console.log(`   Verification:`);
        console.log(`      - arrival_date present: ${hasArrivalDate ? '✓' : '✗'}`);
        console.log(`      - departure_date present: ${hasDepartureDate ? '✓' : '✗'}`);
      } else {
        console.log(`   ⊘ Already normalized - skipping`);
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                        Summary                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('✅ Templates fixed directly in database');
    console.log('');
    console.log('Next steps:');
    console.log('1. Add ONE line to BookingEmailDataService.js:');
    console.log('   emailData.accommodation = firstRoom.RoomType?.name || "";');
    console.log('');
    console.log('2. Restart: pm2 restart all');
    console.log('');
    console.log('3. Test: Change booking status to "Confirmed"');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

fixTemplates();