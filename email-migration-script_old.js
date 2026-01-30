/**
 * Auto-Discovery Email Template Migration Script
 * 
 * This script automatically discovers and migrates ALL email templates
 * from /templates/email/ directory to the database.
 * 
 * It skips EmailTrigger templates and layout.html
 * 
 * Run with: node migrate-all-email-templates-auto.js
 */

const fs = require('fs').promises;
const path = require('path');
const { EmailTemplate } = require('./models');

const TEMPLATES_DIR = path.join(process.cwd(), 'templates', 'email');

// Templates to skip (already migrated EmailTrigger templates + layout)
const SKIP_TEMPLATES = [
  'funder-external-booking',
  'internal-recipient-new-booking',
  'external-recipient-new-booking',
  'recipient-booking-amended',
  'internal-recipient-health-info',
  'internal-recipient-health-info-bak',
  'booking-highlights',
  'internal-recipient-foundation-stay',
  'layout'
];

/**
 * Generate template metadata from filename
 */
function generateMetadataFromFilename(filename) {
  // Convert filename to readable name
  const name = filename
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Generate subject based on template type
  let subject = '';
  let category = 'general';
  
  if (filename.includes('booking')) {
    subject = `Booking Notification - {{guest_name}}`;
    category = 'booking';
  } else if (filename.includes('guest') || filename.includes('profile')) {
    subject = `Your Information - Sargood on Collaroy`;
    category = 'guest';
  } else if (filename.includes('course')) {
    subject = `Course Information`;
    category = 'course';
  } else if (filename.includes('password') || filename.includes('reset')) {
    subject = `Reset Your Password`;
    category = 'auth';
  } else if (filename.includes('email-confirmation') || filename.includes('verification')) {
    subject = `Verify Your Email Address`;
    category = 'auth';
  } else if (filename.includes('account')) {
    subject = `Account Notification`;
    category = 'auth';
  } else if (filename.includes('icare')) {
    subject = `iCare Update - {{guest_name}}`;
    category = 'booking';
  } else {
    subject = `Notification from Sargood on Collaroy`;
  }
  
  return {
    name: name,
    subject: subject,
    description: `Auto-migrated template: ${filename}`,
    category: category
  };
}

/**
 * Read template file
 */
async function readTemplateFile(filename) {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${filename}.html`);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    return null;
  }
}

/**
 * Check if template exists in database by name
 */
async function checkTemplateExists(templateName) {
  const existing = await EmailTemplate.findOne({
    where: { name: templateName }
  });
  return existing;
}

/**
 * Discover all HTML templates
 */
async function discoverAllTemplates() {
  try {
    const files = await fs.readdir(TEMPLATES_DIR);
    const htmlFiles = files
      .filter(f => f.endsWith('.html') && !f.endsWith('-bak.html'))
      .map(f => f.replace('.html', ''))
      .filter(f => !SKIP_TEMPLATES.includes(f));
    
    return htmlFiles;
  } catch (error) {
    console.error('Error discovering templates:', error.message);
    return [];
  }
}

/**
 * Migrate single template
 */
async function migrateTemplate(templateKey) {
  try {
    const metadata = generateMetadataFromFilename(templateKey);
    
    console.log(`\n📧 ${templateKey}`);
    console.log(`   Name: ${metadata.name}`);
    console.log(`   Category: ${metadata.category}`);
    
    // Check if already exists
    const existing = await checkTemplateExists(metadata.name);
    
    if (existing) {
      console.log(`   ✓ Already in database (ID: ${existing.id})`);
      return { 
        id: existing.id, 
        key: templateKey, 
        status: 'skipped', 
        name: metadata.name,
        category: metadata.category 
      };
    }
    
    // Read HTML file
    const htmlContent = await readTemplateFile(templateKey);
    
    if (!htmlContent) {
      console.log(`   ⚠️  HTML file not found`);
      return { 
        key: templateKey, 
        status: 'file_not_found', 
        name: metadata.name 
      };
    }
    
    // Create in database
    const newTemplate = await EmailTemplate.create({
      name: metadata.name,
      subject: metadata.subject,
      description: metadata.description,
      html_content: htmlContent,
      json_design: { 
        html: htmlContent,
        category: metadata.category,
        original_filename: templateKey
      },
      is_active: true
    });
    
    console.log(`   ✓ Migrated successfully (ID: ${newTemplate.id})`);
    return { 
      id: newTemplate.id, 
      key: templateKey, 
      status: 'migrated', 
      name: metadata.name,
      category: metadata.category 
    };
    
  } catch (error) {
    console.error(`   ✗ Migration failed:`, error.message);
    return { 
      key: templateKey, 
      status: 'failed', 
      error: error.message 
    };
  }
}

/**
 * Main migration
 */
async function migrateAllTemplates() {
  console.log('=======================================================');
  console.log('  AUTO-DISCOVERY EMAIL TEMPLATE MIGRATION');
  console.log('=======================================================\n');
  
  console.log(`Templates directory: ${TEMPLATES_DIR}\n`);
  
  // Discover all templates
  console.log('🔍 Discovering email templates...\n');
  const allTemplates = await discoverAllTemplates();
  
  console.log(`Found ${allTemplates.length} templates to migrate:\n`);
  allTemplates.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t}.html`);
  });
  
  console.log('\n');
  console.log('ℹ️  Skipping (already migrated):');
  SKIP_TEMPLATES.forEach(t => console.log(`   - ${t}`));
  console.log('');
  
  // Migrate all templates
  console.log('=======================================================');
  console.log('Starting Migration');
  console.log('=======================================================');
  
  const results = {
    migrated: [],
    skipped: [],
    failed: [],
    fileNotFound: []
  };
  
  for (const templateKey of allTemplates) {
    const result = await migrateTemplate(templateKey);
    
    switch (result.status) {
      case 'migrated':
        results.migrated.push(result);
        break;
      case 'skipped':
        results.skipped.push(result);
        break;
      case 'failed':
        results.failed.push(result);
        break;
      case 'file_not_found':
        results.fileNotFound.push(result);
        break;
    }
  }
  
  // Summary
  console.log('\n\n=======================================================');
  console.log('Migration Summary');
  console.log('=======================================================\n');
  
  if (results.migrated.length > 0) {
    console.log(`✓ Newly Migrated: ${results.migrated.length}`);
    results.migrated.forEach(r => {
      console.log(`  - ${r.key} → ID: ${r.id} (${r.category})`);
    });
    console.log('');
  }
  
  if (results.skipped.length > 0) {
    console.log(`ℹ️  Already in Database: ${results.skipped.length}`);
    results.skipped.forEach(r => {
      console.log(`  - ${r.key} → ID: ${r.id}`);
    });
    console.log('');
  }
  
  if (results.fileNotFound.length > 0) {
    console.log(`⚠️  File Not Found: ${results.fileNotFound.length}`);
    results.fileNotFound.forEach(r => {
      console.log(`  - ${r.key}.html`);
    });
    console.log('');
  }
  
  if (results.failed.length > 0) {
    console.log(`✗ Failed: ${results.failed.length}`);
    results.failed.forEach(r => {
      console.log(`  - ${r.key}: ${r.error}`);
    });
    console.log('');
  }
  
  // Generate complete template IDs
  console.log('\n=======================================================');
  console.log('Complete Template ID Constants');
  console.log('=======================================================\n');
  
  const allDbTemplates = await EmailTemplate.findAll({
    attributes: ['id', 'name', 'json_design'],
    order: [['id', 'ASC']]
  });
  
  if (allDbTemplates.length > 0) {
    console.log('Save this to services/booking/templateIds.js:\n');
    console.log('/**');
    console.log(' * Email Template ID Constants');
    console.log(' * Generated: ' + new Date().toISOString().split('T')[0]);
    console.log(' * Total Templates: ' + allDbTemplates.length);
    console.log(' */\n');
    console.log('module.exports = {');
    
    // Group by category
    const byCategory = {};
    allDbTemplates.forEach(t => {
      const category = t.json_design?.category || 'other';
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(t);
    });
    
    // Output by category
    const categoryOrder = ['booking', 'guest', 'course', 'auth', 'general', 'other'];
    categoryOrder.forEach(category => {
      const templates = byCategory[category];
      if (templates && templates.length > 0) {
        console.log(`  // ${category.toUpperCase()}`);
        templates.forEach(t => {
          const constantName = t.name
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
          console.log(`  ${constantName}: ${t.id}, // ${t.name}`);
        });
        console.log('');
      }
    });
    
    console.log('};\n');
  }
  
  // Generate complete fallback map
  console.log('\n=======================================================');
  console.log('Complete Template Fallback Map');
  console.log('=======================================================\n');
  console.log('Save this to services/booking/templateFallbackMap.js:\n');
  console.log('/**');
  console.log(' * Template ID to Physical HTML Filename Mapping');
  console.log(' * Used for automatic fallback');
  console.log(' */\n');
  console.log('module.exports = {');
  
  // Create mapping for all templates
  allDbTemplates.forEach(t => {
    const originalFilename = t.json_design?.original_filename;
    if (originalFilename) {
      console.log(`  ${t.id}: '${originalFilename}', // ${t.name}`);
    }
  });
  
  console.log('};\n');
  
  // Next steps
  console.log('\n=======================================================');
  console.log('Next Steps');
  console.log('=======================================================\n');
  console.log('1. ✅ All templates have been migrated to database');
  console.log('2. 📋 Copy template IDs to services/booking/templateIds.js');
  console.log('3. 📋 Copy fallback map to services/booking/templateFallbackMap.js');
  console.log('4. 🔧 Update EmailService (if not already updated)');
  console.log('5. 🔍 Identify which APIs use which templates');
  console.log('6. 🔧 Update API endpoints to use EmailService');
  console.log('7. 🧪 Test each API endpoint');
  console.log('8. 🛡️  Keep physical HTML files as fallback\n');
  
  // Template usage analysis
  console.log('\n=======================================================');
  console.log('Template Usage Analysis');
  console.log('=======================================================\n');
  console.log('Review your codebase to find which APIs use which templates:\n');
  console.log('Commands to help identify usage:');
  console.log('  grep -r "SendEmail" pages/api/ --include="*.js"');
  console.log('  grep -r "sendMail" pages/api/ --include="*.js"\n');
  console.log('Common patterns to look for:');
  console.log('  - SendEmail(email, subject, "template-name", data)');
  console.log('  - sendMail(email, subject, "template-name", data)\n');
  
  return results;
}

// Run if executed directly
if (require.main === module) {
  migrateAllTemplates()
    .then(() => {
      console.log('✓ Migration completed!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateAllTemplates };