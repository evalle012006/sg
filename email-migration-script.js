/**
 * Migration Script for Guest Cancellation Email Templates
 * 
 * This script adds the two new guest cancellation email templates to the database:
 * - booking-guest-cancellation-request.html (guest notification)
 * - booking-guest-cancellation-request-admin.html (admin notification)
 * 
 * Run with: node migrate-guest-cancellation-templates.js
 */

const fs = require('fs').promises;
const path = require('path');
const { EmailTemplate } = require('./models');

const TEMPLATES_DIR = path.join(process.cwd(), 'templates', 'email');

// New templates to migrate
const NEW_TEMPLATES = [
  {
    filename: 'booking-guest-cancellation-request',
    name: 'Booking Guest Cancellation Request',
    subject: 'Cancellation Request Received - {{guest_name}}',
    description: 'Email sent to guest when they request to cancel their booking',
    category: 'booking'
  },
  {
    filename: 'booking-guest-cancellation-request-admin',
    name: 'Booking Guest Cancellation Request Admin',
    subject: 'Guest Cancellation Request - {{guest_name}}',
    description: 'Admin notification email when a guest requests to cancel their booking',
    category: 'booking'
  }
];

/**
 * Read template file
 */
async function readTemplateFile(filename) {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${filename}.html`);
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading file ${filename}.html:`, error.message);
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
 * Migrate single template
 */
async function migrateTemplate(templateConfig) {
  try {
    console.log(`\n📧 ${templateConfig.filename}`);
    console.log(`   Name: ${templateConfig.name}`);
    console.log(`   Category: ${templateConfig.category}`);
    
    // Check if already exists
    const existing = await checkTemplateExists(templateConfig.name);
    
    if (existing) {
      console.log(`   ✓ Already in database (ID: ${existing.id})`);
      return { 
        id: existing.id, 
        filename: templateConfig.filename, 
        status: 'skipped', 
        name: templateConfig.name,
        category: templateConfig.category 
      };
    }
    
    // Read HTML file
    const htmlContent = await readTemplateFile(templateConfig.filename);
    
    if (!htmlContent) {
      console.log(`   ✗ HTML file not found or could not be read`);
      return { 
        filename: templateConfig.filename, 
        status: 'file_not_found', 
        name: templateConfig.name 
      };
    }
    
    // Create in database
    const newTemplate = await EmailTemplate.create({
      name: templateConfig.name,
      subject: templateConfig.subject,
      description: templateConfig.description,
      html_content: htmlContent,
      json_design: { 
        html: htmlContent,
        category: templateConfig.category,
        original_filename: templateConfig.filename
      },
      is_active: true
    });
    
    console.log(`   ✓ Migrated successfully (ID: ${newTemplate.id})`);
    return { 
      id: newTemplate.id, 
      filename: templateConfig.filename, 
      status: 'migrated', 
      name: templateConfig.name,
      category: templateConfig.category 
    };
    
  } catch (error) {
    console.error(`   ✗ Migration failed:`, error.message);
    return { 
      filename: templateConfig.filename, 
      status: 'failed', 
      error: error.message,
      name: templateConfig.name
    };
  }
}

/**
 * Main migration
 */
async function migrateGuestCancellationTemplates() {
  console.log('=======================================================');
  console.log('  GUEST CANCELLATION EMAIL TEMPLATES MIGRATION');
  console.log('=======================================================\n');
  
  console.log(`Templates directory: ${TEMPLATES_DIR}\n`);
  console.log(`Migrating ${NEW_TEMPLATES.length} new templates:\n`);
  
  NEW_TEMPLATES.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.filename}.html`);
    console.log(`     → ${t.name}`);
  });
  
  console.log('\n=======================================================');
  console.log('Starting Migration');
  console.log('=======================================================');
  
  const results = {
    migrated: [],
    skipped: [],
    failed: [],
    fileNotFound: []
  };
  
  for (const templateConfig of NEW_TEMPLATES) {
    const result = await migrateTemplate(templateConfig);
    
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
      console.log(`  - ${r.filename} → ID: ${r.id}`);
    });
    console.log('');
  }
  
  if (results.skipped.length > 0) {
    console.log(`ℹ️  Already in Database: ${results.skipped.length}`);
    results.skipped.forEach(r => {
      console.log(`  - ${r.filename} → ID: ${r.id}`);
    });
    console.log('');
  }
  
  if (results.fileNotFound.length > 0) {
    console.log(`⚠️  File Not Found: ${results.fileNotFound.length}`);
    results.fileNotFound.forEach(r => {
      console.log(`  - ${r.filename}.html`);
    });
    console.log('');
  }
  
  if (results.failed.length > 0) {
    console.log(`✗ Failed: ${results.failed.length}`);
    results.failed.forEach(r => {
      console.log(`  - ${r.filename}: ${r.error}`);
    });
    console.log('');
  }
  
  // Generate updated template IDs if any were migrated
  if (results.migrated.length > 0) {
    console.log('\n=======================================================');
    console.log('Updated Template ID Constants');
    console.log('=======================================================\n');
    
    console.log('Add these to your services/booking/templateIds.js:\n');
    results.migrated.forEach(r => {
      const constantName = r.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      console.log(`  ${constantName}: ${r.id}, // ${r.name}`);
    });
    console.log('');
    
    console.log('\n=======================================================');
    console.log('Updated Template Fallback Map');
    console.log('=======================================================\n');
    
    console.log('Add these to your services/booking/templateFallbackMap.js:\n');
    results.migrated.forEach(r => {
      console.log(`  ${r.id}: '${r.filename}', // ${r.name}`);
    });
    console.log('');
  }
  
  // Next steps
  console.log('\n=======================================================');
  console.log('Next Steps');
  console.log('=======================================================\n');
  
  if (results.migrated.length > 0) {
    console.log('1. ✅ Templates migrated to database');
    console.log('2. 📋 Add the template IDs to services/booking/templateIds.js');
    console.log('3. 📋 Add the fallback mappings to services/booking/templateFallbackMap.js');
    console.log('4. 🔧 Update your handler code to use the new template IDs:');
    console.log('     TEMPLATE_IDS.BOOKING_GUEST_CANCELLATION_REQUEST');
    console.log('     TEMPLATE_IDS.BOOKING_GUEST_CANCELLATION_REQUEST_ADMIN');
    console.log('5. 🧪 Test the guest_cancelled case in your booking status handler');
  } else if (results.skipped.length > 0) {
    console.log('✓ Templates already exist in database');
    console.log('✓ No action needed - you can use the existing template IDs');
  } else {
    console.log('⚠️  No templates were migrated');
    console.log('   Please check that the HTML files exist in templates/email/');
  }
  
  console.log('');
  
  return results;
}

// Run if executed directly
if (require.main === module) {
  migrateGuestCancellationTemplates()
    .then(() => {
      console.log('✓ Migration completed!\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateGuestCancellationTemplates };