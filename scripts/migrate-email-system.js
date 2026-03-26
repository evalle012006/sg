/**
 * Complete Email System Migration
 * 
 * 1. Adds required_variables column to email_templates
 * 2. Normalizes ALL email templates to snake_case
 * 3. Updates existing email triggers with filter fields
 * 
 * Usage: node scripts/migrate-email-system.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { EmailTemplate, EmailTrigger, sequelize } = require('../models');

/**
 * PART 1: Add required_variables column if not exists
 */
async function addRequiredVariablesColumn() {
  console.log('\n📋 PART 1: Checking email_templates table structure...\n');

  const [results] = await sequelize.query(`
    SELECT COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'email_templates' 
      AND COLUMN_NAME = 'required_variables'
  `);

  if (results.length > 0) {
    console.log('✓ Column "required_variables" already exists');
    return { alreadyExists: true };
  }

  console.log('📝 Adding "required_variables" column...');
  
  await sequelize.query(`
    ALTER TABLE email_templates 
    ADD COLUMN required_variables JSON NULL 
    COMMENT 'Array of variable names used in this template'
    AFTER json_design
  `);

  console.log('✅ Column added successfully!\n');
  return { alreadyExists: false };
}

/**
 * PART 2: Normalize template tags to snake_case
 */
function normalizeTemplateTags(html) {
  if (!html) return { normalized: html, changes: [] };
  
  let normalized = html;
  const changes = [];
  
  // Convert hyphenated tags (check-in-date → check_in_date)
  normalized = normalized.replace(
    /\{\{([#/]?)([a-zA-Z][\w-]*?)(\s|[^}]*)?\}\}/g,
    (match, prefix, tagName, suffix) => {
      if (tagName.includes('-')) {
        const converted = tagName.replace(/-/g, '_');
        changes.push(`${tagName} → ${converted}`);
        return `{{${prefix}${converted}${suffix || ''}}}`;
      }
      return match;
    }
  );
  
  // Convert camelCase tags (arrivalDate → arrival_date)
  normalized = normalized.replace(
    /\{\{([#/]?)([a-z][a-zA-Z0-9]*?)(\s|[^}]*)?\}\}/g,
    (match, prefix, tagName, suffix) => {
      if (/[A-Z]/.test(tagName)) {
        const converted = tagName
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/^_/, '');
        changes.push(`${tagName} → ${converted}`);
        return `{{${prefix}${converted}${suffix || ''}}}`;
      }
      return match;
    }
  );
  
  return { normalized, changes };
}

/**
 * Extract variable names from template
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
 * PART 3: Normalize all email templates
 */
async function normalizeEmailTemplates() {
  console.log('\n📋 PART 2: Normalizing email templates to snake_case...\n');

  const templates = await EmailTemplate.findAll();
  console.log(`Found ${templates.length} email templates to process\n`);

  let updated = 0;
  let skipped = 0;
  const summary = [];

  for (const template of templates) {
    const { normalized, changes } = normalizeTemplateTags(template.html_content);
    
    if (changes.length === 0) {
      console.log(`⊘  Skipping: ${template.name} (already normalized)`);
      skipped++;
      continue;
    }

    const variables = extractTemplateVariables(normalized);
    
    // Update template
    await template.update({
      html_content: normalized,
      required_variables: variables,
      json_design: {
        ...template.json_design,
        html: normalized,
        variables: variables
      }
    });

    console.log(`✓  Updated: ${template.name}`);
    console.log(`   Changes: ${changes.length} tag(s) normalized`);
    changes.slice(0, 3).forEach(change => console.log(`      • ${change}`));
    if (changes.length > 3) {
      console.log(`      ... and ${changes.length - 3} more`);
    }
    console.log(`   Variables: ${variables.length} stored`);
    console.log('');

    updated++;
    summary.push({
      id: template.id,
      name: template.name,
      changesCount: changes.length,
      variablesCount: variables.length
    });
  }

  return { updated, skipped, summary };
}

/**
 * PART 4: Update email triggers with filter fields
 */
async function updateEmailTriggers() {
  console.log('\n📋 PART 3: Updating email triggers with filter fields...\n');

  // Get ALL existing triggers (no where clause - no name/event_type columns!)
  const triggers = await EmailTrigger.findAll();
  console.log(`Found ${triggers.length} email triggers to process\n`);

  let updated = 0;
  let skipped = 0;

  for (const trigger of triggers) {
    // Check if trigger already has filter fields
    const hasFilters = trigger.booking_status_filter || 
                      trigger.booking_eligibility_filter || 
                      trigger.guest_flag_filter || 
                      trigger.booking_flag_filter;

    if (hasFilters) {
      console.log(`⊘  Skipping: Trigger ID ${trigger.id} (already has filters)`);
      skipped++;
      continue;
    }

    // Default safety filters for all triggers
    const updates = {
      guest_flag_filter: {
        exclude: ['deceased', 'banned']
      }
    };

    // Smart defaults based on template ID
    // Templates 19 & 20 = Booking Confirmed emails
    if (trigger.email_template_id === 19 || trigger.email_template_id === 20) {
      updates.booking_status_filter = ['Confirmed'];
      console.log(`✓  Updated: Trigger ID ${trigger.id} (template ${trigger.email_template_id})`);
      console.log(`   Added: booking_status_filter = ['Confirmed']`);
      console.log(`   Added: guest_flag_filter = { exclude: ['deceased', 'banned'] }`);
    } else {
      console.log(`✓  Updated: Trigger ID ${trigger.id} (template ${trigger.email_template_id})`);
      console.log(`   Added: guest_flag_filter = { exclude: ['deceased', 'banned'] }`);
    }

    await trigger.update(updates);
    updated++;
    console.log('');
  }

  return { updated, skipped };
}

/**
 * Main migration function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Complete Email System Migration                   ║');
  console.log('║   Templates + Triggers + Normalization                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Database connection established');

    // Part 1: Add column
    const columnResult = await addRequiredVariablesColumn();

    // Part 2: Normalize templates
    const templateResult = await normalizeEmailTemplates();

    // Part 3: Update triggers
    const triggerResult = await updateEmailTriggers();

    // Final Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Migration Summary                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('DATABASE SCHEMA:');
    console.log(`  ${columnResult.alreadyExists ? '⊘' : '✓'} required_variables column ${columnResult.alreadyExists ? '(existed)' : '(added)'}`);
    
    console.log('\nEMAIL TEMPLATES:');
    console.log(`  ✓ Updated: ${templateResult.updated} templates`);
    console.log(`  ⊘ Skipped: ${templateResult.skipped} templates (already normalized)`);
    
    if (templateResult.summary.length > 0) {
      console.log('\nTemplate Changes:');
      templateResult.summary.forEach(t => {
        console.log(`  • ${t.name}: ${t.changesCount} tag(s) → ${t.variablesCount} variables`);
      });
    }

    console.log('\nEMAIL TRIGGERS:');
    console.log(`  ✓ Updated: ${triggerResult.updated} triggers`);
    console.log(`  ⊘ Skipped: ${triggerResult.skipped} triggers (already have filters)`);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      Next Steps                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('1. ✅ Templates normalized to snake_case');
    console.log('2. ✅ Triggers updated with safety filters');
    console.log('3. ⚠️  Add ONE line to BookingEmailDataService.js:');
    console.log('');
    console.log('   File: services/booking/BookingEmailDataService.js');
    console.log('   Location: addRoomData() method, line ~603');
    console.log('   Add: emailData.accommodation = firstRoom.RoomType?.name || "";');
    console.log('');
    console.log('4. Restart: pm2 restart all');
    console.log('5. Test: Change booking status to "Confirmed"');
    console.log('');
    console.log('✓ Migration complete\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { 
  addRequiredVariablesColumn, 
  normalizeEmailTemplates,
  updateEmailTriggers,
  normalizeTemplateTags,
  extractTemplateVariables
};