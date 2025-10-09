'use strict';

const { EmailTrigger, EmailTemplate } = require('../models');
const fs = require('fs');
const path = require('path');

/**
 * Migration script to convert existing email triggers to use the new template system
 * This script will:
 * 1. Find all email triggers without email_template_id
 * 2. Read the corresponding HTML template file
 * 3. Create a new EmailTemplate record
 * 4. Update the trigger to reference the new template
 */
async function migrateEmailTriggers() {
  try {
    console.log('\n========================================');
    console.log('Email Trigger Migration Script');
    console.log('========================================\n');

    // Get all existing email triggers without template_id
    const triggers = await EmailTrigger.findAll({
      where: {
        email_template_id: null,
        email_template: {
          [require('sequelize').Op.not]: null
        }
      }
    });

    console.log(`📊 Found ${triggers.length} triggers to migrate\n`);

    if (triggers.length === 0) {
      console.log('✅ No triggers need migration. All done!');
      return;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const trigger of triggers) {
      try {
        const templateName = trigger.email_template;
        
        console.log(`\n🔄 Processing trigger #${trigger.id}:`);
        console.log(`   Recipient: ${trigger.recipient}`);
        console.log(`   Old template: ${templateName}`);

        // Read the old template HTML file
        const templatePath = path.join(
          __dirname,
          '..',
          'templates',
          'email',
          `${templateName}.html`
        );

        if (!fs.existsSync(templatePath)) {
          console.log(`   ⚠️  Template file not found: ${templatePath}`);
          console.log(`   ⏭️  Skipping...`);
          skipCount++;
          continue;
        }

        const htmlContent = fs.readFileSync(templatePath, 'utf-8');

        // Generate template name
        const newTemplateName = templateName
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        // Generate subject based on template type
        let subject = 'Sargood On Collaroy - ';
        if (templateName.includes('booking')) {
          subject += 'New Booking';
        } else if (templateName.includes('amendment')) {
          subject += 'Booking Amendment';
        } else {
          subject += newTemplateName;
        }

        // Check if template already exists
        const existingTemplate = await EmailTemplate.findOne({
          where: {
            name: `Migrated: ${newTemplateName}`,
            template_type: 'migrated'
          }
        });

        let emailTemplate;

        if (existingTemplate) {
          console.log(`   ♻️  Using existing migrated template #${existingTemplate.id}`);
          emailTemplate = existingTemplate;
        } else {
          // Create new email template
          emailTemplate = await EmailTemplate.create({
            name: `Migrated: ${newTemplateName}`,
            subject: subject,
            description: `Migrated from legacy template: ${templateName}`,
            html_content: htmlContent,
            template_type: 'migrated',
            is_active: true
          });

          console.log(`   ✨ Created new template #${emailTemplate.id}`);
        }

        // Update trigger to reference new template
        await trigger.update({
          email_template_id: emailTemplate.id
        });

        console.log(`   ✅ Migrated trigger #${trigger.id} → template #${emailTemplate.id}`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error migrating trigger #${trigger.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================');
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${triggers.length}`);
    console.log('========================================\n');

    if (errorCount > 0) {
      console.log('⚠️  Some triggers failed to migrate. Please review the errors above.');
      process.exit(1);
    } else {
      console.log('🎉 Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateEmailTriggers()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = migrateEmailTriggers;